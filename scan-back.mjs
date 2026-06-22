import path from 'node:path'
import { toRepoPath, displayLabel, escapeRegExp, readText, stripCSharpComments, stripCSharpStringLiterals } from './scan-utils.mjs'
import { getProjectMap } from './config.mjs'
import { classifyBack, featureFromRepoPath } from './classify.mjs'
import { addEndpoint, normalizeEndpoint } from './endpoints.mjs'

let backFilesByName = new Map()

export function initBackFileIndex(allBackFiles) {
  backFilesByName = new Map()
  for (const file of allBackFiles) {
    const key = path.basename(file).toLowerCase()
    const bucket = backFilesByName.get(key)
    if (bucket) bucket.push(file)
    else backFilesByName.set(key, [file])
  }
}

export function findBackFileByName(fileName, preferModule) {
  const bucket = backFilesByName.get(fileName.toLowerCase())
  if (!bucket) return undefined
  if (preferModule) {
    const sameModule = bucket.find(file => featureFromRepoPath(toRepoPath(file)) === preferModule)
    if (sameModule) return sameModule
  }
  return bucket[0]
}

export function scanBackFiles(graph, files) {
  for (const file of files) {
    const repoPath = toRepoPath(file)
    let [type, layer] = classifyBack(repoPath)
    if ((type === 'command' || type === 'query') && isMarkerInterfaceFile(file)) {
      [type, layer] = ['auxiliary', 'auxiliary']
    }
    graph.addNode(`file:${repoPath}`, {
      label: displayLabel(repoPath),
      type,
      layer,
      module: featureFromRepoPath(repoPath),
      path: repoPath
    })
  }
}

function isMarkerInterfaceFile(file) {
  const stem = path.basename(file, '.cs')
  const looksLikeInterface = /^I[A-Z]/.test(stem)
  if (!looksLikeInterface) return false
  return new RegExp(`\\binterface\\s+${escapeRegExp(stem)}\\b`).test(readText(file))
}

export function scanControllers(graph, files) {
  const endpoints = []
  const controllerRoutePattern = /\[Route\("([^"]+)"\)\][\s\S]*?class\s+(\w+)/m

  for (const file of files) {
    const repoPath = toRepoPath(file)
    const content = readText(file)
    const module = featureFromRepoPath(repoPath)
    const id = `file:${repoPath}`
    const routeMatch = content.match(controllerRoutePattern)

    graph.addNode(id, {
      label: displayLabel(repoPath),
      type: 'controller',
      layer: 'api-controller',
      module,
      path: repoPath
    })

    const baseRoute = normalizeEndpoint(`/${routeMatch?.[1] ?? ''}`)
    if (baseRoute) {
      for (const match of content.matchAll(/\[Http(Get|Post|Put|Patch|Delete)(?:\("([^"]*)"\))?\][\s\S]{0,900}?public\s+async\s+Task<IActionResult>\s+(\w+)/g)) {
        const method = match[1].toUpperCase()
        const actionRoute = match[2] ?? ''
        const fullUrl = normalizeEndpoint(`${baseRoute}/${actionRoute}`)
        if (!fullUrl) continue
        const endpoint = addEndpoint(graph, fullUrl, method, module)
        endpoints.push({ id: endpoint, url: fullUrl, method, controllerId: id })
        graph.addEdge(endpoint, id, 'handled-by', { confidence: 'high' })
      }
    }

    for (const requestName of collectDispatchedRequests(content)) {
      linkRequest(graph, id, requestName, module, 'high')
    }
  }

  return endpoints
}

function collectDispatchedRequests(content) {
  const code = stripCSharpComments(stripCSharpStringLiterals(content))
  const requests = new Set()
  for (const match of code.matchAll(/new\s+([A-Z]\w+(?:Query|Command))\b/g)) {
    requests.add(match[1])
  }
  for (const match of code.matchAll(/(?:\[From(?:Body|Query|Route|Form)\][^,()]*?\b|\(\s*|,\s*)([A-Z]\w+(?:Query|Command))\s+\w+/g)) {
    requests.add(match[1])
  }
  return requests
}

function linkRequest(graph, sourceId, requestName, module, confidence) {
  const requestPath = findBackFileByName(`${requestName}.cs`, module)
  const target = requestPath ? `file:${toRepoPath(requestPath)}` : `request:${requestName}`
  graph.addNode(target, {
    label: requestName,
    type: requestName.endsWith('Query') ? 'query' : 'command',
    layer: 'application-boundary',
    module,
    path: requestPath ? toRepoPath(requestPath) : undefined
  })
  graph.addEdge(sourceId, target, 'sends', { confidence })
}

export function scanRequestDispatches(graph, files) {
  const controllerFragment = getProjectMap().backend?.controllerPathFragment ?? '/Controllers/'
  for (const file of files) {
    const repoPath = toRepoPath(file)
    if (repoPath.includes(controllerFragment)) continue
    const id = `file:${repoPath}`
    if (!graph.hasNode(id)) continue
    const module = featureFromRepoPath(repoPath)
    const content = stripCSharpComments(stripCSharpStringLiterals(readText(file)))
    const ownRequest = path.basename(file, '.cs').replace(/Handler$/, '')
    for (const match of content.matchAll(/new\s+([A-Z]\w+(?:Query|Command))\b/g)) {
      const requestName = match[1]
      if (requestName === ownRequest) continue
      linkRequest(graph, id, requestName, module, 'medium')
    }
  }
}

export function scanRequestHandlers(graph, files) {
  const handlerPathFragment = getProjectMap().backend.handlerPathFragment
  for (const file of files.filter(file => toRepoPath(file).includes(handlerPathFragment))) {
    const repoPath = toRepoPath(file)
    const handlerName = path.basename(file, '.cs')
    const requestName = handlerName.replace(/Handler$/, '')
    const requestPath = findBackFileByName(`${requestName}.cs`)
    if (requestPath) {
      graph.addEdge(`file:${toRepoPath(requestPath)}`, `file:${repoPath}`, 'handled-by', { confidence: 'high' })
    }
  }
}

export function scanDatabase(graph, files) {
  const { entityNodeByName, dbSetByEntity, tableByEntity } = extractDbSets(graph, files)
  const entityPropertiesByName = extractEntityProperties(graph, entityNodeByName)
  const tableNodeByEntity = extractTableNodes(graph, entityNodeByName, dbSetByEntity, tableByEntity)
  extractEntityRelationships(graph, entityNodeByName, entityPropertiesByName)
  extractEntityUsage(graph, files, entityNodeByName, dbSetByEntity, tableNodeByEntity)
}

function extractDbSets(graph, files) {
  const entityNodeByName = new Map()
  const dbSetByEntity = new Map()
  const tableByEntity = new Map()

  for (const dbContextPath of findDbContextFiles(files)) {
    const dbId = `file:${toRepoPath(dbContextPath)}`
    const content = readText(dbContextPath)
    for (const match of content.matchAll(/DbSet<(\w+)>\s+(\w+)/g)) {
      const [, entity, dbSet] = match
      dbSetByEntity.set(entity, dbSet)
      const entityPath = findEntityFile(entity)
      const entityId = entityPath ? `file:${toRepoPath(entityPath)}` : `entity:${entity}`
      entityNodeByName.set(entity, entityId)
      graph.addNode(entityId, {
        label: entity,
        type: 'entity',
        layer: 'domain',
        module: entityPath ? domainEntityModule(toRepoPath(entityPath)) : 'shared',
        path: entityPath ? toRepoPath(entityPath) : undefined,
        meta: { dbSet, domain: { properties: [] } }
      })
      graph.addEdge(dbId, entityId, 'dbset', { confidence: 'high' })
    }
  }

  for (const file of files.filter(file => toRepoPath(file).includes(getProjectMap().backend.entityConfigurationPathFragment))) {
    const content = readText(file)
    const configName = path.basename(file, '.cs')
    const entity = configName.replace(/Configuration$/, '')
    const tableMatch = content.match(/\.ToTable\("([^"]+)"\)/)
    if (tableMatch) tableByEntity.set(entity, tableMatch[1])
  }

  return { entityNodeByName, dbSetByEntity, tableByEntity }
}

function extractEntityProperties(graph, entityNodeByName) {
  const entityPropertiesByName = new Map()
  for (const [entity, entityId] of entityNodeByName) {
    if (!entityId.startsWith('file:')) continue
    const filePath = entityId.slice('file:'.length)
    const fullPath = findBackFileByName(path.basename(filePath))
    if (!fullPath) continue
    const properties = parseEntityProperties(readText(fullPath))
    entityPropertiesByName.set(entity, properties)
    graph.addNode(entityId, { meta: { domain: { properties } } })
  }
  return entityPropertiesByName
}

function extractTableNodes(graph, entityNodeByName, dbSetByEntity, tableByEntity) {
  const tableNodeByEntity = new Map()
  for (const [entity, entityId] of entityNodeByName) {
    const tableName = tableByEntity.get(entity) ?? dbSetByEntity.get(entity) ?? `${entity}s`
    const tableId = `table:${tableName}`
    tableNodeByEntity.set(entity, tableId)
    graph.addNode(tableId, {
      label: tableName,
      type: 'table',
      layer: 'database-table',
      module: entityModule(entity, entityNodeByName),
      meta: { entity }
    })
    graph.addEdge(entityId, tableId, 'maps-to-table', { confidence: tableByEntity.has(entity) ? 'high' : 'medium' })
  }
  return tableNodeByEntity
}

function extractEntityRelationships(graph, entityNodeByName, entityPropertiesByName) {
  for (const [entity, properties] of entityPropertiesByName) {
    const entityId = entityNodeByName.get(entity)
    if (!entityId) continue
    for (const property of properties) {
      for (const relatedEntity of entityTypesFromProperty(property.type, entityNodeByName)) {
        if (relatedEntity === entity) continue
        graph.addEdge(entityId, entityNodeByName.get(relatedEntity), 'domain-relation', {
          label: property.name,
          confidence: 'medium'
        })
      }
    }
  }
}

function extractEntityUsage(graph, files, entityNodeByName, dbSetByEntity, tableNodeByEntity) {
  const projectMap = getProjectMap()
  const usageFiles = files.filter(file =>
    toRepoPath(file).includes(projectMap.backend.handlerPathFragment)
    || toRepoPath(file).includes(projectMap.backend.repositoryPathFragment)
  )
  for (const file of usageFiles) {
    const repoPath = toRepoPath(file)
    const content = stripCSharpStringLiterals(readText(file))
    for (const [entity, entityId] of entityNodeByName) {
      const dbSet = dbSetByEntity.get(entity)
      const usage = detectEntityUsage(content, entity, dbSet)
      if (!usage) continue
      const sourceId = `file:${repoPath}`
      graph.addEdge(sourceId, entityId, 'uses-entity', { confidence: usage.confidence, label: usage.reason })
      const tableId = tableNodeByEntity.get(entity)
      if (tableId) {
        graph.addEdge(sourceId, tableId, 'queries-table', { confidence: usage.confidence, label: `ORM ${usage.reason}` })
      }
    }
  }
}

function findDbContextFiles(files) {
  return files.filter(file => {
    const content = readText(file)
    return /\bclass\s+\w+\s*(?:\([^)]*\))?\s*:\s*DbContext\b/.test(content)
      || /\bDbSet<\w+>\s+\w+\s*(?:\{|=>)/.test(content)
  })
}

function detectEntityUsage(content, entity, dbSet) {
  const escapedEntity = escapeRegExp(entity)
  const escapedDbSet = dbSet ? escapeRegExp(dbSet) : null
  const checks = [
    { pattern: new RegExp(`\\bSet\\s*<\\s*${escapedEntity}\\s*>\\s*\\(`), reason: `ORM Set<${entity}>`, confidence: 'high' },
    { pattern: new RegExp(`\\b(?:IRepository|IReadRepository|Repository)\\s*<\\s*${escapedEntity}\\s*>`), reason: `repository ${entity}`, confidence: 'high' },
    { pattern: escapedDbSet ? new RegExp(`\\.[\\s\\r\\n]*${escapedDbSet}\\b|\\b${escapedDbSet}\\s*\\.`) : null, reason: `DbSet ${dbSet}`, confidence: 'high' },
    { pattern: new RegExp(`\\bDomain\\.Entities\\.[A-Za-z0-9_.]+\\.${escapedEntity}\\b`), reason: `qualified entity ${entity}`, confidence: 'medium' },
    { pattern: new RegExp(`\\b${escapedEntity}\\b`), reason: `entity ${entity}`, confidence: 'medium' }
  ]
  return checks.find(check => check.pattern?.test(content)) ?? null
}

function parseEntityProperties(content) {
  const properties = []
  const seen = new Set()
  for (const match of content.matchAll(/public\s+([A-Za-z0-9_<>,.?[\]\s]+?)\s+(\w+)\s*(?:\{|=>)/g)) {
    const type = match[1].replace(/\s+/g, ' ').trim()
    const name = match[2]
    if (name === 'class' || seen.has(name)) continue
    seen.add(name)
    properties.push({ name, type })
  }
  return properties
}

function entityTypesFromProperty(type, entityNodeByName) {
  const candidates = new Set()
  const compactType = type.replace(/\?/g, '')
  for (const match of compactType.matchAll(/<\s*([A-Za-z_]\w*)\s*>/g)) candidates.add(match[1])
  const directMatch = compactType.match(/\b([A-Z]\w*)\b$/)
  if (directMatch) candidates.add(directMatch[1])
  return [...candidates].filter(candidate => entityNodeByName.has(candidate))
}

function findEntityFile(entityName) {
  const exact = findBackFileByName(`${entityName}.cs`)
  if (exact && toRepoPath(exact).includes(getProjectMap().backend.entityPathFragment)) return exact
  return exact
}

function entityModule(entity, entityNodeByName) {
  const entityId = entityNodeByName.get(entity)
  const entityNodePath = entityId?.startsWith('file:') ? entityId.slice('file:'.length) : undefined
  return entityNodePath ? domainEntityModule(entityNodePath) : getProjectMap().modules.shared
}

function domainEntityModule(repoPath) {
  const match = repoPath.match(new RegExp(getProjectMap().modules.backendEntityDomainPattern))
  return match ? match[1].toLowerCase().replace(/[\s._]+/g, '-') : featureFromRepoPath(repoPath)
}
