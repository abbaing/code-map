import path from 'node:path'
import { featureFromRepoPath } from '#core/classify.mjs'
import { findBackFileByName } from '#scanners/scan-back-session.mjs'

export function scanDatabase(graph, files, projectContext, session, sourceDocuments) {
  const { entityNodeByName, dbSetByEntity, tableByEntity } = extractDbSets(
    graph,
    files,
    projectContext,
    session,
    sourceDocuments
  )
  const entityPropertiesByName = extractEntityProperties(graph, entityNodeByName, session, sourceDocuments)
  const tableNodeByEntity = extractTableNodes(graph, entityNodeByName, dbSetByEntity, tableByEntity, projectContext)
  extractEntityRelationships(graph, entityNodeByName, entityPropertiesByName)
  extractEntityUsage(
    graph,
    files,
    entityNodeByName,
    dbSetByEntity,
    tableNodeByEntity,
    projectContext,
    session,
    sourceDocuments
  )
}

function extractDbSets(graph, files, projectContext, session, sourceDocuments) {
  const { toRepoPath } = projectContext
  const entityNodeByName = new Map()
  const dbSetByEntity = new Map()
  const tableByEntity = new Map()

  for (const dbContextPath of findDbContextFiles(files, sourceDocuments)) {
    const dbId = `file:${toRepoPath(dbContextPath)}`
    for (const { entity, name: dbSet } of sourceDocuments.factsOf(dbContextPath, 'dbSets')) {
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
      graph.addEdge(dbId, entityId, 'dbset', {
        confidence: 'high',
        source: 'entity-framework-dbset',
        evidence: `DbSet<${entity}> ${dbSet}`
      })
    }
  }

  for (const file of files.filter((file) =>
    toRepoPath(file).includes(projectContext.projectMap.backend.entityConfigurationPathFragment)
  )) {
    const configName = path.basename(file, '.cs')
    const entity = configName.replace(/Configuration$/, '')
    const tableName = sourceDocuments.factsOf(file, 'tableName')
    if (tableName) {
      tableByEntity.set(entity, tableName)
    }
  }

  return { entityNodeByName, dbSetByEntity, tableByEntity }
}

function extractEntityProperties(graph, entityNodeByName, session, sourceDocuments) {
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
    const propertyAnalysis = sourceDocuments.factsOf(fullPath, 'entityProperties')
    entityPropertiesByName.set(entity, propertyAnalysis)
    graph.addNode(entityId, {
      meta: { domain: { properties: propertyAnalysis.map(({ name, type }) => ({ name, type })) } }
    })
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
    graph.addEdge(entityId, tableId, 'maps-to-table', {
      confidence: tableByEntity.has(entity) ? 'high' : 'medium',
      source: 'entity-framework-table-map',
      evidence: `${entity} -> ${tableName}`
    })
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
      for (const relatedEntity of entityTypesFromProperty(property, entityNodeByName)) {
        if (relatedEntity === entity) {
          continue
        }
        graph.addEdge(entityId, entityNodeByName.get(relatedEntity), 'domain-relation', {
          label: property.name,
          confidence: 'medium',
          source: 'entity-property-type',
          evidence: `${property.name}: ${property.type}`
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
  session,
  sourceDocuments
) {
  const { toRepoPath } = projectContext
  const usageFiles = files.filter((file) =>
    ['handler', 'repository', 'service'].includes(graph.getNode(`file:${toRepoPath(file)}`)?.type)
  )
  for (const file of usageFiles) {
    const repoPath = toRepoPath(file)
    for (const [entity, entityId] of entityNodeByName) {
      const dbSet = dbSetByEntity.get(entity)
      const usage = sourceDocuments.factsOf(file, 'entityUsage', { entity, dbSet })
      if (!usage) {
        continue
      }
      const sourceId = `file:${repoPath}`
      graph.addEdge(sourceId, entityId, 'uses-entity', {
        confidence: usage.confidence,
        label: usage.reason,
        source: 'entity-framework-usage',
        evidence: `${entity}: ${usage.reason}`
      })
      const tableId = tableNodeByEntity.get(entity)
      if (tableId && usage.persistence) {
        graph.addEdge(sourceId, tableId, 'queries-table', {
          confidence: usage.confidence,
          label: `ORM ${usage.reason}`,
          source: 'entity-framework-query',
          evidence: `${entity}: ${usage.reason}`
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
    graph.addEdge(node.id, entityId, 'uses-entity', {
      confidence: 'high',
      label: `generic repository ${entity}`,
      source: 'entity-framework-generic-repository',
      evidence: entity
    })
    const tableId = tableNodeByEntity.get(entity)
    if (tableId) {
      graph.addEdge(node.id, tableId, 'queries-table', {
        confidence: 'high',
        label: `ORM repository ${entity}`,
        source: 'entity-framework-generic-repository',
        evidence: entity
      })
    }
  }
}

function findDbContextFiles(files, sourceDocuments) {
  return files.filter((file) => sourceDocuments.factsOf(file, 'backendSemantics').isDbContext)
}

function entityTypesFromProperty(property, entityNodeByName) {
  return property.typeNames.filter((candidate) => entityNodeByName.has(candidate))
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
