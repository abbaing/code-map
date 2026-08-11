import { createBackFileSet, createBackScanSession, scanDatabase } from '#scanners/scan-back.mjs'

export const entityFrameworkTemplate = {
  id: 'entity-framework',
  stage: 'data',
  requiresTemplates: ['csharp'],
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
        requires: ['graph', 'files', 'projectContext', 'sourceDocuments'],
        optionalRequires: ['backFileSet', 'backSession'],
        run: (context) => {
          const backFileSet = context.backFileSet ?? createBackFileSet(context.files, context.projectContext)
          const session = context.backSession ?? createBackScanSession(backFileSet.all, context.sourceDocuments)
          return scanDatabase(
            context.graph,
            backFileSet.visible,
            context.projectContext,
            session,
            context.sourceDocuments
          )
        }
      }
    ]
  }
}
