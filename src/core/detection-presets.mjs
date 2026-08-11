const layerPresets = {
  full: [
    ['ui-route', 'Routes'],
    ['ui-page', 'Pages'],
    ['ui-main-component', 'Main Components'],
    ['ui-component-logic', 'Components / Logic'],
    ['front-service', 'Frontend Services'],
    ['front-repository', 'Frontend Repositories'],
    ['api-endpoint', 'API Endpoints'],
    ['api-controller', 'Controllers'],
    ['application-request', 'Commands & Queries'],
    ['application-handler', 'Handlers'],
    ['backend-service', 'Backend Services'],
    ['backend-repository', 'Persistence Repositories'],
    ['domain', 'Entities'],
    ['database-table', 'DB Tables']
  ],
  api: [
    ['ui-route', 'Routes'],
    ['ui-page', 'Pages'],
    ['ui-main-component', 'Main Components'],
    ['ui-component-logic', 'Components / Logic'],
    ['front-service', 'Frontend Services'],
    ['front-repository', 'Frontend Repositories'],
    ['api-endpoint', 'API Endpoints'],
    ['api-controller', 'Controllers']
  ],
  ui: [
    ['ui-route', 'Routes'],
    ['ui-page', 'Pages'],
    ['ui-main-component', 'Main Components'],
    ['ui-component-logic', 'Components / Logic'],
    ['front-service', 'Services'],
    ['front-repository', 'Repositories']
  ],
  fallback: [
    ['ui-route', 'Routes'],
    ['ui-page', 'Pages'],
    ['ui-component-logic', 'Components'],
    ['front-service', 'Services'],
    ['api-endpoint', 'API Endpoints']
  ]
}

const dotnetDefaults = {
  entryPointSuffixes: ['/Program.cs'],
  dtoPathFragment: '/DTOs/',
  validatorPathFragment: '/Validators/',
  mappingPathFragment: '/Mappings/',
  controllerPathFragment: '/Controllers/',
  handlerPathFragment: '/Handlers/',
  repositoryPathFragment: '/Repositories/',
  entityConfigurationPathFragment: '/Configurations/Entities/',
  dataContextPathFragment: '/Data/Context/',
  entityPathFragment: '/Entities/',
  classifiers: [
    ['/Controllers/', 'controller', 'api-controller'],
    ['/Queries/', 'query', 'application-request'],
    ['/Commands/', 'command', 'application-request'],
    ['/Handlers/', 'handler', 'application-handler'],
    ['/DTOs/', 'dto', 'hidden-dto'],
    ['/Repositories/', 'auxiliary', 'auxiliary'],
    ['/Configurations/Entities/', 'auxiliary', 'auxiliary'],
    ['/Data/Context/', 'auxiliary', 'auxiliary'],
    ['/Entities/', 'entity', 'domain']
  ].map(toClassifier)
}

const nodeDefaults = {
  entryPointSuffixes: ['/index.js', '/index.ts', '/server.js', '/server.ts', '/app.js', '/app.ts'],
  dtoPathFragment: '/dto/',
  controllerPathFragment: '/controllers/',
  handlerPathFragment: '/handlers/',
  repositoryPathFragment: '/repositories/',
  entityPathFragment: '/entities/',
  classifiers: [
    ['/controllers/', 'controller', 'api-controller'],
    ['/handlers/', 'handler', 'application-handler'],
    ['/repositories/', 'auxiliary', 'auxiliary'],
    ['/entities/', 'entity', 'domain']
  ].map(toClassifier)
}

export function detectLayers(frontend, backend) {
  if (frontend === 'react' && backend === 'dotnet') {
    return layers('full')
  }
  if (frontend === 'react' && ['node', 'go'].includes(backend)) {
    return layers('api')
  }
  if (frontend === 'react' && !backend) {
    return layers('ui')
  }
  return layers('fallback')
}

export function detectBackend(_repoRoot, backendRoot, backendStack) {
  if (!backendRoot || !backendStack) {
    return null
  }
  return { dotnet: dotnetDefaults, node: nodeDefaults }[backendStack] ?? null
}

function layers(name) {
  layerPresets[name] = layerPresets[name].map((value) =>
    Array.isArray(value) ? { id: value[0], label: value[1] } : value
  )
  return layerPresets[name]
}
function toClassifier([contains, type, layer]) {
  return { contains, type, layer }
}
