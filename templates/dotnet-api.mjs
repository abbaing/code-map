import {
  scanBackDependencies,
  scanBackFiles,
  scanControllers,
  scanRequestDispatches,
  scanRequestHandlers,
  createBackScanSession
} from '#scanners/scan-back.mjs'
import { isBackTestFile } from '#core/source-analysis.mjs'

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
    fileKinds: [
      {
        id: 'backend-source',
        rootKey: 'backend',
        extensions: ['.cs'],
        test: (file) => isBackTestFile(file),
        includeTests: false
      }
    ],
    scanners: [
      {
        id: 'dotnet.index',
        assign: 'backSession',
        requires: ['files', 'sourceReader'],
        run: (context) => createBackScanSession(context.files.allBackFiles, context.sourceReader)
      },
      {
        id: 'dotnet.files',
        requires: ['graph', 'files', 'projectContext', 'backSession', 'sourceReader'],
        run: (context) =>
          scanBackFiles(
            context.graph,
            context.files.backFiles,
            context.projectContext,
            context.backSession,
            context.sourceReader
          )
      },
      {
        id: 'dotnet.controllers',
        assign: 'controllerEndpoints',
        requires: ['graph', 'controllerFiles', 'projectContext', 'backSession', 'sourceReader'],
        run: (context) =>
          scanControllers(
            context.graph,
            context.controllerFiles(),
            context.projectContext,
            context.backSession,
            context.sourceReader
          )
      },
      {
        id: 'dotnet.dispatches',
        requires: ['graph', 'files', 'projectContext', 'backSession', 'sourceReader'],
        run: (context) =>
          scanRequestDispatches(
            context.graph,
            context.files.backFiles,
            context.projectContext,
            context.backSession,
            context.sourceReader
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
        requires: ['graph', 'files', 'projectContext', 'backSession', 'sourceReader'],
        run: (context) =>
          scanBackDependencies(
            context.graph,
            context.files.backFiles,
            context.projectContext,
            context.backSession,
            context.sourceReader
          )
      }
    ]
  }
}
