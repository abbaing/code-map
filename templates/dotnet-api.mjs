import {
  scanBackDependencies,
  scanBackFiles,
  scanControllers,
  scanRequestDispatches,
  scanRequestHandlers,
  createBackScanSession
} from '#scanners/scan-back.mjs'

export const dotnetApiTemplate = {
  id: 'dotnet-api',
  stage: 'backend',
  description: '.NET API controllers, request boundaries, and request handler relationships.',
  layers: [
    { id: 'api-controller', label: 'Controllers' },
    { id: 'application-request', label: 'Commands & Queries' },
    { id: 'application-handler', label: 'Handlers' },
    { id: 'backend-service', label: 'Backend Services' },
    { id: 'backend-repository', label: 'Persistence Repositories' }
  ],
  types: {
    labels: {
      command: 'Command',
      controller: 'Controller',
      handler: 'Handler',
      query: 'Query',
      service: 'Service',
      repository: 'Repository',
      'data-context': 'EF DbContext'
    },
    colors: {
      controller: '#c2410c',
      query: '#15803d',
      command: '#15803d',
      handler: '#15803d',
      'data-context': '#7c3aed'
    }
  },
  capabilities: {
    scanners: [
      {
        id: 'dotnet.index',
        assign: 'backSession',
        requires: ['files', 'sourceDocuments'],
        run: (context) => createBackScanSession(context.files.allBackFiles, context.sourceDocuments)
      },
      {
        id: 'dotnet.files',
        requires: ['graph', 'files', 'projectContext', 'backSession', 'sourceDocuments'],
        run: (context) =>
          scanBackFiles(
            context.graph,
            context.files.backFiles,
            context.projectContext,
            context.backSession,
            context.sourceDocuments
          )
      },
      {
        id: 'dotnet.controllers',
        assign: 'controllerEndpoints',
        requires: ['graph', 'controllerFiles', 'projectContext', 'backSession', 'sourceDocuments'],
        run: (context) =>
          scanControllers(
            context.graph,
            context.controllerFiles(),
            context.projectContext,
            context.backSession,
            context.sourceDocuments
          )
      },
      {
        id: 'dotnet.dispatches',
        requires: ['graph', 'files', 'projectContext', 'backSession', 'sourceDocuments'],
        run: (context) =>
          scanRequestDispatches(
            context.graph,
            context.files.backFiles,
            context.projectContext,
            context.backSession,
            context.sourceDocuments
          )
      },
      {
        id: 'dotnet.handlers',
        requires: ['graph', 'files', 'projectContext', 'backSession'],
        run: (context) =>
          scanRequestHandlers(context.graph, context.files.backFiles, context.projectContext, context.backSession)
      },
      {
        id: 'dotnet.dependencies',
        requires: ['graph', 'files', 'projectContext', 'backSession', 'sourceDocuments'],
        run: (context) =>
          scanBackDependencies(
            context.graph,
            context.files.backFiles,
            context.projectContext,
            context.backSession,
            context.sourceDocuments
          )
      }
    ]
  }
}
