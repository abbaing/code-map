import { projectPersistenceEntities } from '#scanners/scan-back-persistence-entities.mjs'
import { projectEntityRelationships } from '#scanners/scan-back-persistence-relationships.mjs'
import { projectPersistenceTables } from '#scanners/scan-back-persistence-tables.mjs'
import { extractEntityUsage } from '#scanners/scan-back-persistence-usage.mjs'

export function scanDatabase(graph, files, projectContext, session, sourceDocuments) {
  const catalog = projectPersistenceEntities({ graph, files, projectContext, session, sourceDocuments })
  const tableNodeByEntity = projectPersistenceTables({ graph, projectContext, ...catalog })
  projectEntityRelationships({ graph, ...catalog })
  extractEntityUsage({
    graph,
    files,
    entityNodeByName: catalog.entityNodeByName,
    dbSetByEntity: catalog.dbSetByEntity,
    tableNodeByEntity,
    projectContext,
    sourceDocuments
  })
}
