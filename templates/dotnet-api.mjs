import { scanBackFiles, scanControllers, scanRequestHandlers, initBackFileIndex } from '../scan-back.mjs'
import { isBackTestFile } from '../scan-utils.mjs'

export const dotnetApiTemplate = {
  id: 'dotnet-api',
  stage: 'backend',
  description: '.NET API controllers, request boundaries, and request handler relationships.',
  layers: [
    { id: 'api-controller', label: 'Controllers' },
    { id: 'application-boundary', label: 'Handlers / Boundaries' }
  ],
  types: {
    labels: {
      command: 'Command',
      controller: 'Controller',
      handler: 'Handler',
      query: 'Query'
    },
    colors: {
      controller: '#c2410c',
      query: '#15803d',
      command: '#15803d',
      handler: '#15803d'
    }
  },
  capabilities: {
    fileKinds: [
      {
        id: 'backend-source',
        rootKey: 'backend',
        extensions: ['.cs'],
        test: file => isBackTestFile(file),
        includeTests: false
      }
    ],
    scanners: [
      { id: 'dotnet.index', run: context => initBackFileIndex(context.files.allBackFiles) },
      { id: 'dotnet.files', run: context => scanBackFiles(context.graph, context.files.backFiles) },
      { id: 'dotnet.controllers', assign: 'controllerEndpoints', run: context => scanControllers(context.graph, context.controllerFiles()) },
      { id: 'dotnet.handlers', run: context => scanRequestHandlers(context.graph, context.files.backFiles) }
    ]
  }
}
