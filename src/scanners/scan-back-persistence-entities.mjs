import { persistenceEntityModule, resolveEntityDeclaration } from '#scanners/scan-back-persistence-resolution.mjs'

export function projectPersistenceEntities({ graph, files, projectContext, session, sourceDocuments }) {
  const entityNodeByName = new Map()
  const entityFileByName = new Map()
  const dbSetByEntity = new Map()
  const tableByEntity = collectTableMappings(files, sourceDocuments)
  const { toRepoPath } = projectContext

  for (const contextPath of contextFiles(files, sourceDocuments)) {
    const contextId = `file:${toRepoPath(contextPath)}`
    const collections =
      sourceDocuments.factsOf(contextPath, 'persistenceCollections') ??
      sourceDocuments.factsOf(contextPath, 'dbSets') ??
      []
    for (const fact of collections) {
      const entityFile = resolveEntityDeclaration(session, fact.entity, projectContext)
      const entityId = entityFile ? `file:${toRepoPath(entityFile)}` : `entity:${fact.entity}`
      entityNodeByName.set(fact.entity, entityId)
      dbSetByEntity.set(fact.entity, fact.name)
      if (entityFile) {
        entityFileByName.set(fact.entity, entityFile)
      }
      graph.addNode(entityId, {
        label: fact.entity,
        type: 'entity',
        layer: 'domain',
        module: entityFile ? persistenceEntityModule(toRepoPath(entityFile), projectContext) : 'shared',
        path: entityFile ? toRepoPath(entityFile) : undefined,
        meta: { dbSet: fact.name, domain: { properties: [] } }
      })
      graph.addEdge(contextId, entityId, 'dbset', {
        confidence: 'high',
        source: 'entity-framework-dbset',
        evidence: fact.evidence ?? `${fact.entity} collection ${fact.name}`
      })
    }
  }

  const entityPropertiesByName = projectEntityProperties(graph, entityNodeByName, entityFileByName, sourceDocuments)
  return { entityNodeByName, dbSetByEntity, tableByEntity, entityPropertiesByName }
}

function collectTableMappings(files, sourceDocuments) {
  const tableByEntity = new Map()
  for (const file of files) {
    const mapping = sourceDocuments.factsOf(file, 'tableMapping')
    if (mapping?.entity && mapping.table) {
      tableByEntity.set(mapping.entity, mapping.table)
    }
  }
  return tableByEntity
}

function projectEntityProperties(graph, entityNodeByName, entityFileByName, sourceDocuments) {
  const propertiesByName = new Map()
  for (const [entity, entityId] of entityNodeByName) {
    const entityFile = entityFileByName.get(entity)
    if (!entityFile) {
      continue
    }
    const properties = sourceDocuments.factsOf(entityFile, 'entityProperties') ?? []
    propertiesByName.set(entity, properties)
    graph.addNode(entityId, {
      meta: { domain: { properties: properties.map(({ name, type }) => ({ name, type })) } }
    })
  }
  return propertiesByName
}

function contextFiles(files, sourceDocuments) {
  return files.filter((file) => sourceDocuments.factsOf(file, 'backendSemantics')?.isDbContext)
}
