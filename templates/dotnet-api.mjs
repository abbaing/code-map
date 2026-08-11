import {
  scanBackDependencies,
  scanBackFiles,
  scanControllers,
  scanRequestDispatches,
  scanRequestHandlers,
  createBackFileSet,
  createBackScanSession
} from '#scanners/scan-back.mjs'

export const dotnetApiTemplate = {
  id: 'dotnet-api',
  stage: 'backend',
  requiresTemplates: ['csharp'],
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
        id: 'dotnet.file-set',
        assign: 'backFileSet',
        requires: ['files', 'projectContext'],
        run: (context) => createBackFileSet(context.files, context.projectContext)
      },
      {
        id: 'dotnet.index',
        assign: 'backSession',
        requires: ['backFileSet', 'sourceDocuments'],
        run: (context) => createBackScanSession(context.backFileSet.all, context.sourceDocuments)
      },
      {
        id: 'dotnet.files',
        requires: ['graph', 'backFileSet', 'projectContext', 'backSession', 'sourceDocuments'],
        run: (context) =>
          scanBackFiles(
            context.graph,
            context.backFileSet.visible,
            context.projectContext,
            context.backSession,
            context.sourceDocuments
          )
      },
      {
        id: 'dotnet.controllers',
        assign: 'controllerEndpoints',
        requires: ['graph', 'backFileSet', 'projectContext', 'backSession', 'sourceDocuments'],
        run: (context) =>
          scanControllers(
            context.graph,
            context.backFileSet.controllers,
            context.projectContext,
            context.backSession,
            context.sourceDocuments
          )
      },
      {
        id: 'dotnet.dispatches',
        requires: ['graph', 'backFileSet', 'projectContext', 'backSession', 'sourceDocuments'],
        run: (context) =>
          scanRequestDispatches(
            context.graph,
            context.backFileSet.visible,
            context.projectContext,
            context.backSession,
            context.sourceDocuments
          )
      },
      {
        id: 'dotnet.handlers',
        requires: ['graph', 'backFileSet', 'projectContext', 'backSession'],
        run: (context) =>
          scanRequestHandlers(context.graph, context.backFileSet.visible, context.projectContext, context.backSession)
      },
      {
        id: 'dotnet.dependencies',
        requires: ['graph', 'backFileSet', 'projectContext', 'backSession', 'sourceDocuments'],
        run: (context) =>
          scanBackDependencies(
            context.graph,
            context.backFileSet.visible,
            context.projectContext,
            context.backSession,
            context.sourceDocuments
          )
      }
    ]
  }
}
