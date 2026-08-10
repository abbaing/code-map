import path from 'node:path'
import {
  csharpArguments,
  csharpDescendants,
  csharpInvocationName,
  csharpName,
  csharpSimpleTypeName,
  csharpStringValue,
  csharpTypeDeclarations,
  csharpTypeIdentifiers,
  parseCSharp,
  walkCSharp
} from '#core/csharp-analysis.mjs'
import { featureFromRepoPath } from '#core/classify.mjs'
import { findBackFileByName } from '#scanners/scan-back-session.mjs'

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
    const tree = parseCSharp(sourceReader.readText(dbContextPath))
    for (const property of csharpDescendants(tree.rootNode, 'property_declaration')) {
      const type =
        property.childForFieldName('type') ?? property.namedChildren.find((child) => child.type === 'generic_name')
      if (type?.type !== 'generic_name' || csharpSimpleTypeName(type) !== 'DbSet') {
        continue
      }
      const entity = csharpDescendants(type, 'type_argument_list').flatMap(csharpTypeIdentifiers)[0]
      const dbSet = csharpName(property)
      if (!entity || !dbSet) {
        continue
      }
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
    const tree = parseCSharp(sourceReader.readText(file))
    const configName = path.basename(file, '.cs')
    const entity = configName.replace(/Configuration$/, '')
    const toTable = csharpDescendants(tree.rootNode, 'invocation_expression').find(
      (invocation) => csharpInvocationName(invocation) === 'ToTable'
    )
    const tableName = csharpStringValue(csharpArguments(toTable)[0])
    if (tableName) {
      tableByEntity.set(entity, tableName)
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
    const propertyAnalysis = parseEntityProperties(sourceReader.readText(fullPath))
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
  sourceReader
) {
  const { toRepoPath } = projectContext
  const usageFiles = files.filter((file) =>
    ['handler', 'repository', 'service'].includes(graph.getNode(`file:${toRepoPath(file)}`)?.type)
  )
  for (const file of usageFiles) {
    const repoPath = toRepoPath(file)
    const tree = parseCSharp(sourceReader.readText(file))
    for (const [entity, entityId] of entityNodeByName) {
      const dbSet = dbSetByEntity.get(entity)
      const usage = detectEntityUsage(tree.rootNode, entity, dbSet)
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

function findDbContextFiles(files, sourceReader) {
  return files.filter((file) => {
    const content = sourceReader.readText(file)
    if (csharpTypeDeclarations(content).some((declaration) => declaration.baseTypes.includes('DbContext'))) {
      return true
    }
    const tree = parseCSharp(content)
    return csharpDescendants(tree.rootNode, 'generic_name').some((node) => csharpSimpleTypeName(node) === 'DbSet')
  })
}

function detectEntityUsage(root, entity, dbSet) {
  let usage = null
  walkCSharp(root, (node) => {
    if (usage?.confidence === 'high') {
      return
    }
    if (node.type === 'generic_name') {
      const name = csharpSimpleTypeName(node)
      const argumentsList = csharpDescendants(node, 'type_argument_list').flatMap(csharpTypeIdentifiers)
      if (argumentsList.includes(entity) && name === 'Set') {
        usage = { reason: `ORM Set<${entity}>`, confidence: 'high', persistence: true }
      } else if (argumentsList.includes(entity) && ['IRepository', 'IReadRepository', 'Repository'].includes(name)) {
        usage = { reason: `repository ${entity}`, confidence: 'high', persistence: true }
      }
    }
    if (dbSet && node.type === 'member_access_expression' && node.namedChildren.some((child) => child.text === dbSet)) {
      usage = { reason: `DbSet ${dbSet}`, confidence: 'high', persistence: true }
    } else if (!usage && node.type === 'identifier' && node.text === entity) {
      usage = { reason: `entity ${entity}`, confidence: 'medium', persistence: false }
    }
  })
  return usage
}

function parseEntityProperties(content) {
  const properties = []
  const seen = new Set()
  const tree = parseCSharp(content)
  for (const property of csharpDescendants(tree.rootNode, 'property_declaration')) {
    if (!property.namedChildren.some((child) => child.type === 'modifier' && child.text === 'public')) {
      continue
    }
    const typeNode =
      property.childForFieldName('type') ?? property.namedChildren.find((child) => child.type !== 'modifier')
    const name = csharpName(property)
    const type = typeNode?.text.replace(/\s+/gu, ' ').trim()
    if (!name || !type || seen.has(name)) {
      continue
    }
    seen.add(name)
    properties.push({ name, type, typeNames: csharpTypeIdentifiers(typeNode) })
  }
  return properties
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
