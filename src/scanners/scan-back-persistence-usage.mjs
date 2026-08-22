export function extractEntityUsage({
  graph,
  files,
  entityNodeByName,
  dbSetByEntity,
  tableNodeByEntity,
  projectContext,
  sourceDocuments
}) {
  const { toRepoPath } = projectContext
  const usageFiles = files.filter((file) =>
    ['handler', 'repository', 'service'].includes(graph.getNode(`file:${toRepoPath(file)}`)?.type)
  )
  for (const file of usageFiles) {
    const repoPath = toRepoPath(file)
    const usages = sourceDocuments.factsOf(file, 'entityUsages', {
      entities: [...entityNodeByName.keys()],
      dbSets: dbSetByEntity
    })
    for (const [entity, usage] of usages ?? []) {
      const entityId = entityNodeByName.get(entity)
      if (!entityId) {
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

  linkRepositoryEntities(graph, entityNodeByName, tableNodeByEntity)
}

function linkRepositoryEntities(graph, entityNodeByName, tableNodeByEntity) {
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
