import path from 'node:path'
import { displayLabel, escapeRegExp, readText, stripCSharpComments, stripCSharpStringLiterals } from './scan-utils.mjs'
import { classifyBack, featureFromRepoPath } from './classify.mjs'
import { addEndpoint, normalizeEndpoint } from './endpoints.mjs'
import { createBackendAnalysisSession } from './backend-analysis-session.mjs'

export function createBackScanSession(allBackFiles) {
  const entries = allBackFiles.map((file) => {
    const content = stripCSharpComments(stripCSharpStringLiterals(readText(file)))
    return { file, fileName: path.basename(file), declarations: csharpTypeDeclarations(content) }
  })
  return createBackendAnalysisSession(entries)
}

export function findBackFileByName(session, fileName, preferModule, projectContext) {
  const bucket = session.filesNamed(fileName)
  if (bucket.length === 0) {
    return undefined
  }
  if (preferModule) {
    const sameModule = bucket.find(
      (file) => featureFromRepoPath(projectContext.toRepoPath(file), projectContext) === preferModule
    )
    if (sameModule) {
      return sameModule
    }
  }
  return bucket[0]
}

export function scanBackFiles(graph, files, projectContext, session) {
  const { toRepoPath } = projectContext
  for (const file of files) {
    const repoPath = toRepoPath(file)
    let [type, layer] = classifyBack(repoPath, projectContext)
    ;[type, layer] = semanticBackendRole(repoPath, type, layer)
    if (type === 'handler' && !isRequestHandlerFile(file)) {
      ;[type, layer] = semanticSupportRole(repoPath)
    }
    if (isDbContextFile(file)) {
      ;[type, layer] = ['data-context', 'backend-repository']
    }
    if (type === 'repository' && isImplementedRepositoryInterface(file, session)) {
      ;[type, layer] = ['auxiliary', 'auxiliary']
    }
    if ((type === 'command' || type === 'query') && isMarkerInterfaceFile(file)) {
      ;[type, layer] = ['auxiliary', 'auxiliary']
    }
    graph.addNode(`file:${repoPath}`, {
      label: displayLabel(repoPath),
      type,
      layer,
      module: featureFromRepoPath(repoPath, projectContext),
      path: repoPath
    })
  }
}

function isDbContextFile(file) {
  const content = stripCSharpComments(stripCSharpStringLiterals(readText(file)))
  return (
    /\bclass\s+\w+\s*(?:\([^)]*\))?\s*:\s*DbContext\b/.test(content) || /\bDbSet<\w+>\s+\w+\s*(?:\{|=>)/.test(content)
  )
}

function isImplementedRepositoryInterface(file, session) {
  const stem = path.basename(file, '.cs')
  return /^I[A-Z]/.test(stem) && session.implementationsOf(stem).length > 0
}

function isRequestHandlerFile(file) {
  const stem = path.basename(file, '.cs')
  const content = stripCSharpComments(stripCSharpStringLiterals(readText(file)))
  return /\bIRequestHandler\s*</.test(content) || /(?:Command|Query)Handler$/.test(stem)
}

function semanticBackendRole(repoPath, type, layer) {
  if (type === 'command' || type === 'query') {
    return [type, 'application-request']
  }
  if (type === 'handler') {
    return [type, 'application-handler']
  }
  if (type !== 'auxiliary') {
    return [type, layer]
  }
  const stem = path.basename(repoPath, '.cs')
  if (repoPath.includes('/Repositories/') || /Repository$/.test(stem)) {
    return ['repository', 'backend-repository']
  }
  if (
    /Service$/.test(stem) ||
    (!repoPath.includes('/Models/') &&
      !repoPath.includes('/Configuration/') &&
      (repoPath.includes('/Services/') ||
        /(?:Client|Provider|Resolver|Sender|Processor|Orchestrator|Selector|Adapter|Worker|Queue|Runtime|Guard|Factory)$/.test(
          stem
        )))
  ) {
    return ['service', 'backend-service']
  }
  return [type, layer]
}

function semanticSupportRole(repoPath) {
  const stem = path.basename(repoPath, '.cs')
  if (
    /(?:Service|Client|Provider|Resolver|Sender|Processor|Orchestrator|Selector|Adapter|Worker|Queue|Runtime|Guard|Factory)$/.test(
      stem
    )
  ) {
    return ['service', 'backend-service']
  }
  return ['auxiliary', 'auxiliary']
}

function isMarkerInterfaceFile(file) {
  const stem = path.basename(file, '.cs')
  const looksLikeInterface = /^I[A-Z]/.test(stem)
  if (!looksLikeInterface) {
    return false
  }
  return new RegExp(`\\binterface\\s+${escapeRegExp(stem)}\\b`).test(readText(file))
}

export function scanControllers(graph, files, projectContext, session) {
  const { toRepoPath } = projectContext
  const endpoints = []
  const controllerRoutePattern = /\[Route\("([^"]+)"\)\][\s\S]*?class\s+(\w+)/m

  for (const file of files) {
    const repoPath = toRepoPath(file)
    const content = readText(file)
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
        graph.addEdge(endpoint, id, 'handled-by', { confidence: 'high' })
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
  graph.addEdge(sourceId, target, 'sends', { confidence, label: source ? `dispatches in ${source}` : 'sends' })
}

export function scanBackDependencies(graph, files, projectContext, session) {
  const { toRepoPath } = projectContext
  for (const file of files) {
    const repoPath = toRepoPath(file)
    const sourceId = `file:${repoPath}`
    if (!graph.hasNode(sourceId)) {
      continue
    }
    const content = stripCSharpComments(stripCSharpStringLiterals(readText(file)))
    const declaration = csharpTypeDeclarations(content).find((item) => item.kind === 'class')
    if (!declaration) {
      continue
    }

    for (const dependency of collectConstructorDependencies(content, declaration.name)) {
      const target = resolveDependencyTarget(dependency.name, repoPath, projectContext, session)
      if (!target || target.file === file) {
        continue
      }
      const genericEntity = dependency.display.match(/<\s*([A-Z]\w*)\s*>/)?.[1]
      const isRepositoryAbstraction =
        genericEntity &&
        /(?:Repository|Searchable|Pageable|Includable|Aggregatable|BulkOperations|Stateful)/.test(dependency.name)
      const useLogicalDependency = isRepositoryAbstraction || target.ambiguous
      const logicalType = dependencyRole(dependency.name)
      const targetId = isRepositoryAbstraction
        ? `backend-repository:${featureFromRepoPath(repoPath, projectContext)}:${dependency.display.replace(/\s+/g, '')}`
        : target.ambiguous
          ? `backend-${logicalType}:${featureFromRepoPath(repoPath, projectContext)}:${dependency.display.replace(/\s+/g, '')}`
          : `file:${toRepoPath(target.file)}`
      if (useLogicalDependency) {
        graph.addNode(targetId, {
          label: dependency.display,
          type: logicalType,
          layer: logicalType === 'repository' ? 'backend-repository' : 'backend-service',
          module: featureFromRepoPath(repoPath, projectContext),
          meta: {
            backendDependency: {
              abstraction: dependency.display,
              implementation: toRepoPath(target.file),
              ...(genericEntity ? { entity: genericEntity } : {}),
              ...(target.ambiguous ? { implementationCandidates: target.alternatives } : {})
            }
          }
        })
      } else if (!graph.hasNode(targetId)) {
        continue
      }
      graph.addEdge(sourceId, targetId, 'depends-on', {
        confidence: target.implementation && !target.ambiguous ? 'high' : 'medium',
        label: dependency.display
      })
    }
  }
}

function dependencyRole(typeName) {
  return /(?:Repository|Searchable|Pageable|Includable|Aggregatable|BulkOperations|Stateful)/.test(typeName)
    ? 'repository'
    : 'service'
}

function collectConstructorDependencies(content, className) {
  const blocks = []
  const primary = content.match(
    new RegExp(`\\bclass\\s+${escapeRegExp(className)}(?:\\s*<[^>{]+>)?\\s*\\(([\\s\\S]{0,3000}?)\\)\\s*(?::|\\{)`)
  )
  if (primary) {
    blocks.push(primary[1])
  }
  const constructors = new RegExp(`\\b${escapeRegExp(className)}\\s*\\(([\\s\\S]{0,3000}?)\\)\\s*(?::[^\\{]+)?\\{`, 'g')
  for (const match of content.matchAll(constructors)) {
    blocks.push(match[1])
  }

  const dependencies = new Map()
  for (const block of blocks) {
    for (const match of block.matchAll(/(?:^|,)\s*([A-ZI][\w.]*(?:\s*<[^>]+>)?)\s+\w+/gm)) {
      const display = match[1].replace(/\s+/g, ' ').trim()
      const name = display.match(/(?:^|\.)([A-ZI]\w*)\s*(?:<|$)/)?.[1]
      if (name) {
        dependencies.set(`${name}:${display}`, { name, display })
      }
    }
  }
  return [...dependencies.values()]
}

function resolveDependencyTarget(typeName, sourcePath, projectContext, session) {
  const implementations = session.implementationsOf(typeName)
  const preferredImplementation = preferDependencyCandidate(implementations, sourcePath, projectContext)
  if (preferredImplementation) {
    return {
      ...preferredImplementation,
      implementation: true,
      ambiguous: implementations.length > 1,
      alternatives: implementations.map((item) => projectContext.toRepoPath(item.file)).sort()
    }
  }
  const declarations = session.declarationsNamed(typeName)
  return preferDependencyCandidate(declarations, sourcePath, projectContext)
}

function preferDependencyCandidate(candidates, sourcePath, projectContext) {
  if (!candidates.length) {
    return null
  }
  const sourceModule = featureFromRepoPath(sourcePath, projectContext)
  return (
    candidates.find(
      (candidate) => featureFromRepoPath(projectContext.toRepoPath(candidate.file), projectContext) === sourceModule
    ) ??
    candidates.find((candidate) => !projectContext.toRepoPath(candidate.file).includes('.Tests/')) ??
    candidates[0]
  )
}

function csharpTypeDeclarations(content) {
  const declarations = []
  const pattern = /\b(class|interface)\s+(\w+)(?:\s*<[^>{]+>)?(?:\s*\([^)]*\))?\s*(?::\s*([^{]+))?\s*\{/g
  for (const match of content.matchAll(pattern)) {
    const baseTypes = (match[3] ?? '')
      .split(',')
      .map((value) => value.trim().match(/(?:^|\.)([A-ZI]\w*)\s*(?:<|$)/)?.[1])
      .filter(Boolean)
    declarations.push({ kind: match[1], name: match[2], baseTypes })
  }
  return declarations
}

export function scanRequestDispatches(graph, files, projectContext, session) {
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
    const content = stripCSharpComments(stripCSharpStringLiterals(readText(file)))
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
      graph.addEdge(`file:${toRepoPath(requestPath)}`, `file:${repoPath}`, 'handled-by', { confidence: 'high' })
    }
  }
}

export function scanDatabase(graph, files, projectContext, session) {
  const { entityNodeByName, dbSetByEntity, tableByEntity } = extractDbSets(graph, files, projectContext, session)
  const entityPropertiesByName = extractEntityProperties(graph, entityNodeByName, session)
  const tableNodeByEntity = extractTableNodes(graph, entityNodeByName, dbSetByEntity, tableByEntity, projectContext)
  extractEntityRelationships(graph, entityNodeByName, entityPropertiesByName)
  extractEntityUsage(graph, files, entityNodeByName, dbSetByEntity, tableNodeByEntity, projectContext)
}

function extractDbSets(graph, files, projectContext, session) {
  const { toRepoPath } = projectContext
  const entityNodeByName = new Map()
  const dbSetByEntity = new Map()
  const tableByEntity = new Map()

  for (const dbContextPath of findDbContextFiles(files)) {
    const dbId = `file:${toRepoPath(dbContextPath)}`
    const content = readText(dbContextPath)
    for (const match of content.matchAll(/DbSet<(\w+)>\s+(\w+)/g)) {
      const [, entity, dbSet] = match
      dbSetByEntity.set(entity, dbSet)
      const entityPath = findEntityFile(entity, projectContext, session)
      const entityId = entityPath ? `file:${toRepoPath(entityPath)}` : `entity:${entity}`
      entityNodeByName.set(entity, entityId)
      graph.addNode(entityId, {
        label: entity,
        type: 'entity',
        layer: 'domain',
        module: entityPath ? domainEntityModule(toRepoPath(entityPath), projectContext) : 'shared',
        path: entityPath ? toRepoPath(entityPath) : undefined,
        meta: { dbSet, domain: { properties: [] } }
      })
      graph.addEdge(dbId, entityId, 'dbset', { confidence: 'high' })
    }
  }

  for (const file of files.filter((file) =>
    toRepoPath(file).includes(projectContext.projectMap.backend.entityConfigurationPathFragment)
  )) {
    const content = readText(file)
    const configName = path.basename(file, '.cs')
    const entity = configName.replace(/Configuration$/, '')
    const tableMatch = content.match(/\.ToTable\("([^"]+)"\)/)
    if (tableMatch) {
      tableByEntity.set(entity, tableMatch[1])
    }
  }

  return { entityNodeByName, dbSetByEntity, tableByEntity }
}

function extractEntityProperties(graph, entityNodeByName, session) {
  const entityPropertiesByName = new Map()
  for (const [entity, entityId] of entityNodeByName) {
    if (!entityId.startsWith('file:')) {
      continue
    }
    const filePath = entityId.slice('file:'.length)
    const fullPath = findBackFileByName(session, path.basename(filePath))
    if (!fullPath) {
      continue
    }
    const properties = parseEntityProperties(readText(fullPath))
    entityPropertiesByName.set(entity, properties)
    graph.addNode(entityId, { meta: { domain: { properties } } })
  }
  return entityPropertiesByName
}

function extractTableNodes(graph, entityNodeByName, dbSetByEntity, tableByEntity, projectContext) {
  const tableNodeByEntity = new Map()
  for (const [entity, entityId] of entityNodeByName) {
    const tableName = tableByEntity.get(entity) ?? dbSetByEntity.get(entity) ?? `${entity}s`
    const tableId = `table:${tableName}`
    tableNodeByEntity.set(entity, tableId)
    graph.addNode(tableId, {
      label: tableName,
      type: 'table',
      layer: 'database-table',
      module: entityModule(entity, entityNodeByName, projectContext),
      meta: { entity }
    })
    graph.addEdge(entityId, tableId, 'maps-to-table', { confidence: tableByEntity.has(entity) ? 'high' : 'medium' })
  }
  return tableNodeByEntity
}

function extractEntityRelationships(graph, entityNodeByName, entityPropertiesByName) {
  for (const [entity, properties] of entityPropertiesByName) {
    const entityId = entityNodeByName.get(entity)
    if (!entityId) {
      continue
    }
    for (const property of properties) {
      for (const relatedEntity of entityTypesFromProperty(property.type, entityNodeByName)) {
        if (relatedEntity === entity) {
          continue
        }
        graph.addEdge(entityId, entityNodeByName.get(relatedEntity), 'domain-relation', {
          label: property.name,
          confidence: 'medium'
        })
      }
    }
  }
}

function extractEntityUsage(graph, files, entityNodeByName, dbSetByEntity, tableNodeByEntity, projectContext) {
  const { toRepoPath } = projectContext
  const usageFiles = files.filter((file) =>
    ['handler', 'repository', 'service', 'data-context'].includes(graph.getNode(`file:${toRepoPath(file)}`)?.type)
  )
  for (const file of usageFiles) {
    const repoPath = toRepoPath(file)
    const content = stripCSharpStringLiterals(readText(file))
    for (const [entity, entityId] of entityNodeByName) {
      const dbSet = dbSetByEntity.get(entity)
      const usage = detectEntityUsage(content, entity, dbSet)
      if (!usage) {
        continue
      }
      const sourceId = `file:${repoPath}`
      graph.addEdge(sourceId, entityId, 'uses-entity', { confidence: usage.confidence, label: usage.reason })
      const tableId = tableNodeByEntity.get(entity)
      if (tableId && usage.persistence) {
        graph.addEdge(sourceId, tableId, 'queries-table', {
          confidence: usage.confidence,
          label: `ORM ${usage.reason}`
        })
      }
    }
  }

  for (const node of graph.allNodes()) {
    const entity = node.meta?.backendDependency?.entity
    const entityId = entityNodeByName.get(entity)
    if (!entityId || node.type !== 'repository') {
      continue
    }
    graph.addEdge(node.id, entityId, 'uses-entity', { confidence: 'high', label: `generic repository ${entity}` })
    const tableId = tableNodeByEntity.get(entity)
    if (tableId) {
      graph.addEdge(node.id, tableId, 'queries-table', { confidence: 'high', label: `ORM repository ${entity}` })
    }
  }
}

function findDbContextFiles(files) {
  return files.filter((file) => {
    const content = readText(file)
    return (
      /\bclass\s+\w+\s*(?:\([^)]*\))?\s*:\s*DbContext\b/.test(content) || /\bDbSet<\w+>\s+\w+\s*(?:\{|=>)/.test(content)
    )
  })
}

function detectEntityUsage(content, entity, dbSet) {
  const escapedEntity = escapeRegExp(entity)
  const escapedDbSet = dbSet ? escapeRegExp(dbSet) : null
  const checks = [
    {
      pattern: new RegExp(`\\bSet\\s*<\\s*${escapedEntity}\\s*>\\s*\\(`),
      reason: `ORM Set<${entity}>`,
      confidence: 'high',
      persistence: true
    },
    {
      pattern: new RegExp(`\\b(?:IRepository|IReadRepository|Repository)\\s*<\\s*${escapedEntity}\\s*>`),
      reason: `repository ${entity}`,
      confidence: 'high',
      persistence: true
    },
    {
      pattern: escapedDbSet ? new RegExp(`\\.[\\s\\r\\n]*${escapedDbSet}\\b|\\b${escapedDbSet}\\s*\\.`) : null,
      reason: `DbSet ${dbSet}`,
      confidence: 'high',
      persistence: true
    },
    {
      pattern: new RegExp(`\\bDomain\\.Entities\\.[A-Za-z0-9_.]+\\.${escapedEntity}\\b`),
      reason: `qualified entity ${entity}`,
      confidence: 'medium',
      persistence: false
    },
    {
      pattern: new RegExp(`\\b${escapedEntity}\\b`),
      reason: `entity ${entity}`,
      confidence: 'medium',
      persistence: false
    }
  ]
  return checks.find((check) => check.pattern?.test(content)) ?? null
}

function parseEntityProperties(content) {
  const properties = []
  const seen = new Set()
  for (const match of content.matchAll(/public\s+([A-Za-z0-9_<>,.?[\]\s]+?)\s+(\w+)\s*(?:\{|=>)/g)) {
    const type = match[1].replace(/\s+/g, ' ').trim()
    const name = match[2]
    if (name === 'class' || seen.has(name)) {
      continue
    }
    seen.add(name)
    properties.push({ name, type })
  }
  return properties
}

function entityTypesFromProperty(type, entityNodeByName) {
  const candidates = new Set()
  const compactType = type.replace(/\?/g, '')
  for (const match of compactType.matchAll(/<\s*([A-Za-z_]\w*)\s*>/g)) {
    candidates.add(match[1])
  }
  const directMatch = compactType.match(/\b([A-Z]\w*)\b$/)
  if (directMatch) {
    candidates.add(directMatch[1])
  }
  return [...candidates].filter((candidate) => entityNodeByName.has(candidate))
}

function findEntityFile(entityName, projectContext, session) {
  const exact = findBackFileByName(session, `${entityName}.cs`, undefined, projectContext)
  if (exact && projectContext.toRepoPath(exact).includes(projectContext.projectMap.backend.entityPathFragment)) {
    return exact
  }
  return exact
}

function entityModule(entity, entityNodeByName, projectContext) {
  const entityId = entityNodeByName.get(entity)
  const entityNodePath = entityId?.startsWith('file:') ? entityId.slice('file:'.length) : undefined
  return entityNodePath ? domainEntityModule(entityNodePath, projectContext) : projectContext.projectMap.modules.shared
}

function domainEntityModule(repoPath, projectContext) {
  const match = repoPath.match(new RegExp(projectContext.projectMap.modules.backendEntityDomainPattern))
  return match ? match[1].toLowerCase().replace(/[\s._]+/g, '-') : featureFromRepoPath(repoPath, projectContext)
}
