import { createBackScanSession, scanDatabase } from '../scan-back.mjs'

export const entityFrameworkTemplate = {
  id: 'entity-framework',
  stage: 'data',
  description: 'Entity Framework entities, DbSet declarations, table mappings, and ORM usage.',
  layers: [
    { id: 'domain', label: 'Entities' },
    { id: 'database-table', label: 'DB Tables' }
  ],
  types: {
    labels: { entity: 'Entity', table: 'DB Table' },
    colors: { entity: '#9333ea', table: '#9333ea' }
  },
  capabilities: {
    scanners: [
      {
        id: 'entity-framework.database',
        requires: ['graph', 'files', 'projectContext', 'sourceReader'],
        optionalRequires: ['backSession'],
        run: (context) => {
          const session = context.backSession ?? createBackScanSession(context.files.allBackFiles, context.sourceReader)
          return scanDatabase(
            context.graph,
            context.files.backFiles,
            context.projectContext,
            session,
            context.sourceReader
          )
        }
      }
    ]
  }
}
