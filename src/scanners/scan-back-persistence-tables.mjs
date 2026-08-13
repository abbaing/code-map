import { entityModule } from '#scanners/scan-back-persistence-resolution.mjs'

export function projectPersistenceTables({ graph, entityNodeByName, dbSetByEntity, tableByEntity, projectContext }) {
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
