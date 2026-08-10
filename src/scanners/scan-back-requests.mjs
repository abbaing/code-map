import path from 'node:path'
import {
  csharpAttributes,
  csharpDescendants,
  csharpInvocationName,
  csharpName,
  csharpSimpleTypeName,
  parseCSharp,
  walkCSharp
} from '#core/csharp-analysis.mjs'
import { featureFromRepoPath } from '#core/classify.mjs'
import { addEndpoint, normalizeEndpoint } from '#core/endpoints.mjs'
import { displayLabel } from '#core/source-analysis.mjs'
import { findBackFileByName } from '#scanners/scan-back-session.mjs'

export function scanControllers(graph, files, projectContext, session, sourceReader) {
  const { toRepoPath } = projectContext
  const endpoints = []

  for (const file of files) {
    const repoPath = toRepoPath(file)
    const content = sourceReader.readText(file)
    const tree = parseCSharp(content)
    const controller = firstNode(tree.rootNode, 'class_declaration')
    const module = featureFromRepoPath(repoPath, projectContext)
    const id = `file:${repoPath}`
    const controllerName = csharpName(controller) ?? path.basename(file, '.cs')

    graph.addNode(id, {
      label: displayLabel(repoPath),
      type: 'controller',
      layer: 'api-controller',
      module,
      path: repoPath
    })

    const route = csharpAttributes(controller).find((attribute) => attribute.name === 'Route')?.value
    const baseRoute = normalizeEndpoint(`/${route ?? ''}`)
    if (!baseRoute) {
      continue
    }

    for (const action of parseControllerActions(controller)) {
      const fullUrl = normalizeEndpoint(`${baseRoute}/${action.route}`)
      if (!fullUrl) {
        continue
      }
      const endpoint = addEndpoint(graph, fullUrl, action.method, module)
      graph.addNode(endpoint, {
        meta: {
          url: fullUrl,
          method: action.method,
          backend: { action: action.name, controller: controllerName, path: repoPath }
        }
      })
      endpoints.push({
        id: endpoint,
        url: fullUrl,
        method: action.method,
        controllerId: id,
        action: action.name
      })
      graph.addEdge(endpoint, id, 'handled-by', {
        confidence: 'high',
        source: 'dotnet-controller-route',
        evidence: `${action.method} ${fullUrl}`
      })
      for (const requestName of dispatchedRequestsForAction(controller, action.node)) {
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

  return endpoints
}

function parseControllerActions(controller) {
  const body = controller?.namedChildren.find((child) => child.type === 'declaration_list')
  const actions = []
  for (const method of body?.namedChildren.filter((child) => child.type === 'method_declaration') ?? []) {
    const http = csharpAttributes(method).find((attribute) =>
      ['HttpGet', 'HttpPost', 'HttpPut', 'HttpPatch', 'HttpDelete'].includes(attribute.name)
    )
    if (!http) {
      continue
    }
    actions.push({
      method: http.name.slice('Http'.length).toUpperCase(),
      route: http.value ?? '',
      name: csharpName(method),
      node: method
    })
  }
  return actions
}

function dispatchedRequestsForAction(controller, action) {
  const requests = collectDispatchedRequests(action)
  if (requests.size > 0) {
    return requests
  }
  const body = controller.namedChildren.find((child) => child.type === 'declaration_list')
  const methods = new Map(
    (body?.namedChildren.filter((child) => child.type === 'method_declaration') ?? []).map((method) => [
      csharpName(method),
      method
    ])
  )
  for (const helperName of collectInvokedMethodNames(action)) {
    const helper = methods.get(helperName)
    if (helper) {
      for (const request of collectDispatchedRequests(helper)) {
        requests.add(request)
      }
    }
  }
  return requests
}

function collectInvokedMethodNames(node) {
  const names = new Set()
  const ignored = new Set(['Send', 'Ok', 'BadRequest', 'NoContent', 'StatusCode', 'Unauthorized', 'NotFound'])
  walkCSharp(node, (candidate) => {
    if (candidate.type !== 'invocation_expression' || candidate.namedChildren[0]?.type !== 'identifier') {
      return
    }
    const name = csharpInvocationName(candidate)
    if (name && /^[A-Z]/u.test(name) && !ignored.has(name)) {
      names.add(name)
    }
  })
  return names
}

function collectDispatchedRequests(node) {
  const requests = new Set()
  walkCSharp(node, (candidate) => {
    if (candidate.type === 'object_creation_expression') {
      const name = csharpSimpleTypeName(candidate.namedChildren[0])
      if (isRequestName(name)) {
        requests.add(name)
      }
    }
    if (candidate.type === 'parameter') {
      const type =
        candidate.childForFieldName('type') ?? candidate.namedChildren.find((child) => child.type !== 'attribute_list')
      const name = csharpSimpleTypeName(type)
      if (isRequestName(name)) {
        requests.add(name)
      }
    }
  })
  return requests
}

function isRequestName(name) {
  return typeof name === 'string' && (name.endsWith('Query') || name.endsWith('Command'))
}

function firstNode(root, type) {
  let result = null
  walkCSharp(root, (node) => {
    if (!result && node.type === type) {
      result = node
    }
  })
  return result
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
    const tree = parseCSharp(sourceReader.readText(file))
    const ownRequest = path.basename(file, '.cs').replace(/Handler$/u, '')
    for (const creation of csharpDescendants(tree.rootNode, 'object_creation_expression')) {
      const requestName = csharpSimpleTypeName(creation.namedChildren[0])
      if (!isRequestName(requestName) || requestName === ownRequest) {
        continue
      }
      linkRequest(graph, id, requestName, module, 'medium', undefined, projectContext, session)
    }
  }
}

export function scanRequestHandlers(graph, files, projectContext, session) {
  const { toRepoPath } = projectContext
  const handlerPathFragment = projectContext.projectMap.backend.handlerPathFragment
  for (const file of files.filter((candidate) => toRepoPath(candidate).includes(handlerPathFragment))) {
    const repoPath = toRepoPath(file)
    const handlerName = path.basename(file, '.cs')
    const requestName = handlerName.replace(/Handler$/u, '')
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
