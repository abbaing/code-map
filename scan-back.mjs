import path from 'node:path'
import { displayLabel, escapeRegExp, stripCSharpComments, stripCSharpStringLiterals } from './source-analysis.mjs'
import { classifyBack, featureFromRepoPath } from './classify.mjs'
import { scanBackDependencies } from './scan-back-dependencies.mjs'
import { createBackScanSession, findBackFileByName } from './scan-back-session.mjs'
import { scanControllers, scanRequestDispatches, scanRequestHandlers } from './scan-back-requests.mjs'

export {
  createBackScanSession,
  findBackFileByName,
  scanBackDependencies,
  scanControllers,
  scanRequestDispatches,
  scanRequestHandlers
}

export function scanBackFiles(graph, files, projectContext, session, sourceReader) {
  const { toRepoPath } = projectContext
  for (const file of files) {
    const repoPath = toRepoPath(file)
    let [type, layer] = classifyBack(repoPath, projectContext)
    ;[type, layer] = semanticBackendRole(repoPath, type, layer)
    if (type === 'handler' && !isRequestHandlerFile(file, sourceReader)) {
      ;[type, layer] = semanticSupportRole(repoPath)
    }
    if (isDbContextFile(file, sourceReader)) {
      ;[type, layer] = ['data-context', 'backend-repository']
    }
    if (type === 'repository' && isImplementedRepositoryInterface(file, session)) {
      ;[type, layer] = ['auxiliary', 'auxiliary']
    }
    if ((type === 'command' || type === 'query') && isMarkerInterfaceFile(file, sourceReader)) {
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

function isDbContextFile(file, sourceReader) {
  const content = stripCSharpComments(stripCSharpStringLiterals(sourceReader.readText(file)))
  return (
    /\bclass\s+\w+\s*(?:\([^)]*\))?\s*:\s*DbContext\b/.test(content) || /\bDbSet<\w+>\s+\w+\s*(?:\{|=>)/.test(content)
  )
}

function isImplementedRepositoryInterface(file, session) {
  const stem = path.basename(file, '.cs')
  return /^I[A-Z]/.test(stem) && session.implementationsOf(stem).length > 0
}

function isRequestHandlerFile(file, sourceReader) {
  const stem = path.basename(file, '.cs')
  const content = stripCSharpComments(stripCSharpStringLiterals(sourceReader.readText(file)))
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

function isMarkerInterfaceFile(file, sourceReader) {
  const stem = path.basename(file, '.cs')
  const looksLikeInterface = /^I[A-Z]/.test(stem)
  if (!looksLikeInterface) {
    return false
  }
  return new RegExp(`\\binterface\\s+${escapeRegExp(stem)}\\b`).test(sourceReader.readText(file))
}

export function scanDatabase(graph, files, projectContext, session, sourceReader) {
  const { entityNodeByName, dbSetByEntity, tableByEntity } = extractDbSets(
    graph,
    files,
    projectContext,
    session,
    sourceReader
  )
  const entityPropertiesByName = extractEntityProperties(graph, entityNodeByName, session, sourceReader)
  const tableNodeByEntity = extractTableNodes(graph, entityNodeByName, dbSetByEntity, tableByEntity, projectContext)
  extractEntityRelationships(graph, entityNodeByName, entityPropertiesByName)
  extractEntityUsage(graph, files, entityNodeByName, dbSetByEntity, tableNodeByEntity, projectContext, sourceReader)
}

function extractDbSets(graph, files, projectContext, session, sourceReader) {
  const { toRepoPath } = projectContext
  const entityNodeByName = new Map()
  const dbSetByEntity = new Map()
  const tableByEntity = new Map()

  for (const dbContextPath of findDbContextFiles(files, sourceReader)) {
    const dbId = `file:${toRepoPath(dbContextPath)}`
    const content = sourceReader.readText(dbContextPath)
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
    const content = sourceReader.readText(file)
    const configName = path.basename(file, '.cs')
    const entity = configName.replace(/Configuration$/, '')
    const tableMatch = content.match(/\.ToTable\("([^"]+)"\)/)
    if (tableMatch) {
      tableByEntity.set(entity, tableMatch[1])
    }
  }

  return { entityNodeByName, dbSetByEntity, tableByEntity }
}

function extractEntityProperties(graph, entityNodeByName, session, sourceReader) {
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
    const properties = parseEntityProperties(sourceReader.readText(fullPath))
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

function extractEntityUsage(
  graph,
  files,
  entityNodeByName,
  dbSetByEntity,
  tableNodeByEntity,
  projectContext,
  sourceReader
) {
  const { toRepoPath } = projectContext
  const usageFiles = files.filter((file) =>
    ['handler', 'repository', 'service', 'data-context'].includes(graph.getNode(`file:${toRepoPath(file)}`)?.type)
  )
  for (const file of usageFiles) {
    const repoPath = toRepoPath(file)
    const content = stripCSharpStringLiterals(sourceReader.readText(file))
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

function findDbContextFiles(files, sourceReader) {
  return files.filter((file) => {
    const content = sourceReader.readText(file)
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
