import path from 'node:path'
import { featureFromRepoPath } from '#core/classify.mjs'
import { addEndpoint, normalizeEndpoint } from '#core/endpoints.mjs'
import { findBackFileByName } from '#scanners/scan-back-session.mjs'
import { displayLabel, escapeRegExp, stripCSharpComments, stripCSharpStringLiterals } from '#core/source-analysis.mjs'

export function scanControllers(graph, files, projectContext, session, sourceReader) {
  const { toRepoPath } = projectContext
  const endpoints = []
  const controllerRoutePattern = /\[Route\("([^"]+)"\)\][\s\S]*?class\s+(\w+)/m

  for (const file of files) {
    const repoPath = toRepoPath(file)
    const content = sourceReader.readText(file)
    const module = featureFromRepoPath(repoPath, projectContext)
    const id = `file:${repoPath}`
    const routeMatch = content.match(controllerRoutePattern)
    const controllerName = routeMatch?.[2] ?? path.basename(file, '.cs')

    graph.addNode(id, {
      label: displayLabel(repoPath),
      type: 'controller',
      layer: 'api-controller',
      module,
      path: repoPath
    })

    const baseRoute = normalizeEndpoint(`/${routeMatch?.[1] ?? ''}`)
    if (baseRoute) {
      for (const action of parseControllerActions(content)) {
        const method = action.method
        const actionRoute = action.route
        const fullUrl = normalizeEndpoint(`${baseRoute}/${actionRoute}`)
        if (!fullUrl) {
          continue
        }
        const endpoint = addEndpoint(graph, fullUrl, method, module)
        graph.addNode(endpoint, {
          meta: {
            url: fullUrl,
            method,
            backend: {
              action: action.name,
              controller: controllerName,
              path: repoPath
            }
          }
        })
        endpoints.push({ id: endpoint, url: fullUrl, method, controllerId: id, action: action.name })
        graph.addEdge(endpoint, id, 'handled-by', {
          confidence: 'high',
          source: 'dotnet-controller-route',
          evidence: `${method} ${fullUrl}`
        })
        for (const requestName of collectDispatchedRequests(action.source)) {
          linkRequest(
            graph,
            endpoint,
            requestName,
            module,
            'high',
            `${controllerName}.${action.name}`,
            projectContext,
            session
          )
        }
      }
    }
  }

  return endpoints
}

function parseControllerActions(content) {
  const actions = []
  const pattern = /\[Http(Get|Post|Put|Patch|Delete)(?:\("([^"]*)"\))?\]/g
  for (const match of content.matchAll(pattern)) {
    const publicIndex = content.indexOf('public ', match.index + match[0].length)
    const nextHttpIndex = content.indexOf('[Http', match.index + match[0].length)
    if (publicIndex < 0 || (nextHttpIndex >= 0 && nextHttpIndex < publicIndex)) {
      continue
    }
    const openParen = content.indexOf('(', publicIndex)
    if (openParen < 0) {
      continue
    }
    const signaturePrefix = content.slice(publicIndex, openParen)
    const name = signaturePrefix.match(/(\w+)\s*$/)?.[1]
    if (!name) {
      continue
    }
    const closeParen = findMatchingDelimiter(content, openParen, '(', ')')
    if (closeParen < 0) {
      continue
    }
    const bodyStart = content.slice(closeParen + 1).search(/\S/) + closeParen + 1
    let bodyEnd = -1
    if (content[bodyStart] === '{') {
      bodyEnd = findMatchingBrace(content, bodyStart)
    } else if (content.slice(bodyStart, bodyStart + 2) === '=>') {
      bodyEnd = content.indexOf(';', bodyStart)
    }
    if (bodyEnd < 0) {
      continue
    }
    let source = content.slice(publicIndex, bodyEnd + 1)
    const directRequests = collectDispatchedRequests(source)
    if (directRequests.size === 0) {
      for (const helperName of collectInvokedMethodNames(source)) {
        const helperSource = findMethodSource(content, helperName)
        if (helperSource) {
          source += `\n${helperSource}`
        }
      }
    }
    actions.push({
      method: match[1].toUpperCase(),
      route: match[2] ?? '',
      name,
      source
    })
  }
  return actions
}

function collectInvokedMethodNames(source) {
  const names = new Set()
  const ignored = new Set(['Send', 'Ok', 'BadRequest', 'NoContent', 'StatusCode', 'Unauthorized', 'NotFound'])
  for (const match of source.matchAll(/(?<![.\w])([A-Z]\w*)\s*\(/g)) {
    if (!ignored.has(match[1])) {
      names.add(match[1])
    }
  }
  return names
}

function findMethodSource(content, methodName) {
  const signature = new RegExp(
    `\\b(?:private|protected|internal)\\s+(?:async\\s+)?[^;{}=]+?\\b${escapeRegExp(methodName)}\\s*\\(`,
    'g'
  )
  const match = signature.exec(content)
  if (!match) {
    return null
  }
  const openParen = content.indexOf('(', match.index)
  const closeParen = findMatchingDelimiter(content, openParen, '(', ')')
  if (closeParen < 0) {
    return null
  }
  const bodyStart = content.slice(closeParen + 1).search(/\S/) + closeParen + 1
  if (content[bodyStart] === '{') {
    const bodyEnd = findMatchingBrace(content, bodyStart)
    return bodyEnd < 0 ? null : content.slice(match.index, bodyEnd + 1)
  }
  if (content.slice(bodyStart, bodyStart + 2) === '=>') {
    const bodyEnd = content.indexOf(';', bodyStart)
    return bodyEnd < 0 ? null : content.slice(match.index, bodyEnd + 1)
  }
  return null
}

function findMatchingDelimiter(content, openIndex, openCharacter, closeCharacter) {
  let depth = 0
  let quote = null
  let escaped = false
  for (let index = openIndex; index < content.length; index += 1) {
    const character = content[index]
    if (quote) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === quote) {
        quote = null
      }
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }
    if (character === openCharacter) {
      depth += 1
    }
    if (character === closeCharacter) {
      depth -= 1
    }
    if (depth === 0) {
      return index
    }
  }
  return -1
}

function findMatchingBrace(content, openBrace) {
  let depth = 0
  let quote = null
  let escaped = false
  for (let index = openBrace; index < content.length; index += 1) {
    const character = content[index]
    if (quote) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === quote) {
        quote = null
      }
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }
    if (character === '{') {
      depth += 1
    }
    if (character === '}') {
      depth -= 1
    }
    if (depth === 0) {
      return index
    }
  }
  return -1
}

function collectDispatchedRequests(content) {
  const code = stripCSharpComments(stripCSharpStringLiterals(content))
  const requests = new Set()
  for (const match of code.matchAll(/new\s+([A-Z]\w+(?:Query|Command))\b/g)) {
    requests.add(match[1])
  }
  for (const match of code.matchAll(
    /(?:\[From(?:Body|Query|Route|Form)\][^,()]*?\b|\(\s*|,\s*)([A-Z]\w+(?:Query|Command))\s+\w+/g
  )) {
    requests.add(match[1])
  }
  return requests
}

function linkRequest(graph, sourceId, requestName, module, confidence, source, projectContext, session) {
  const requestPath = findBackFileByName(session, `${requestName}.cs`, module, projectContext)
  const target = requestPath ? `file:${projectContext.toRepoPath(requestPath)}` : `request:${requestName}`
  graph.addNode(target, {
    label: requestName,
    type: requestName.endsWith('Query') ? 'query' : 'command',
    layer: 'application-request',
    module,
    path: requestPath ? projectContext.toRepoPath(requestPath) : undefined
  })
  graph.addEdge(sourceId, target, 'sends', {
    confidence,
    label: source ? `dispatches in ${source}` : 'sends',
    source: 'dotnet-request-dispatch',
    evidence: requestName
  })
}

export function scanRequestDispatches(graph, files, projectContext, session, sourceReader) {
  const { toRepoPath } = projectContext
  const controllerFragment = projectContext.projectMap.backend?.controllerPathFragment ?? '/Controllers/'
  for (const file of files) {
    const repoPath = toRepoPath(file)
    if (repoPath.includes(controllerFragment)) {
      continue
    }
    const id = `file:${repoPath}`
    if (!graph.hasNode(id)) {
      continue
    }
    const module = featureFromRepoPath(repoPath, projectContext)
    const content = stripCSharpComments(stripCSharpStringLiterals(sourceReader.readText(file)))
    const ownRequest = path.basename(file, '.cs').replace(/Handler$/, '')
    for (const match of content.matchAll(/new\s+([A-Z]\w+(?:Query|Command))\b/g)) {
      const requestName = match[1]
      if (requestName === ownRequest) {
        continue
      }
      linkRequest(graph, id, requestName, module, 'medium', undefined, projectContext, session)
    }
  }
}

export function scanRequestHandlers(graph, files, projectContext, session) {
  const { toRepoPath } = projectContext
  const handlerPathFragment = projectContext.projectMap.backend.handlerPathFragment
  for (const file of files.filter((file) => toRepoPath(file).includes(handlerPathFragment))) {
    const repoPath = toRepoPath(file)
    const handlerName = path.basename(file, '.cs')
    const requestName = handlerName.replace(/Handler$/, '')
    const requestPath = findBackFileByName(
      session,
      `${requestName}.cs`,
      featureFromRepoPath(repoPath, projectContext),
      projectContext
    )
    if (requestPath) {
      graph.addEdge(`file:${toRepoPath(requestPath)}`, `file:${repoPath}`, 'handled-by', {
        confidence: 'high',
        source: 'dotnet-request-handler',
        evidence: requestName
      })
    }
  }
}
