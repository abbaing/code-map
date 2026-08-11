const defaultIgnoredDirs = ['node_modules', 'dist', 'build', 'coverage', 'bin', 'obj', '.git']

const defaultInfrastructureFolders = [
  'assets',
  'behaviors',
  'components',
  'config',
  'configurations',
  'constants',
  'context',
  'contracts',
  'data',
  'entities',
  'exceptions',
  'extensions',
  'helpers',
  'hooks',
  'interceptors',
  'layouts',
  'lib',
  'middleware',
  'middlewares',
  'migrations',
  'models',
  'repositories',
  'routes',
  'schemas',
  'services',
  'specifications',
  'stores',
  'styles',
  'test',
  'tests',
  'types',
  'utils',
  'utilities',
  'validation',
  'valueobjects',
  'value-objects'
]

const defaultFrontendClassifiers = [
  { contains: '/routes/', type: 'route', layer: 'ui-route' },
  { contains: '/pages/', type: 'page', layer: 'ui-page' },
  { contains: '/hooks/', type: 'hook', layer: 'ui-component-logic' },
  { contains: '/services/', type: 'service', layer: 'front-service' },
  { contains: '/repositories/', type: 'repository', layer: 'front-repository' },
  { contains: '/config/', type: 'config', layer: 'config' },
  { contains: '/stores/', type: 'auxiliary', layer: 'auxiliary' },
  { contains: '/types/', type: 'auxiliary', layer: 'auxiliary' },
  { contains: '/schemas/', type: 'config', layer: 'config' },
  { contains: '/utils/', type: 'auxiliary', layer: 'auxiliary' },
  { contains: '/lib/', type: 'auxiliary', layer: 'auxiliary' }
]

const defaultBackendClassifiers = [
  { contains: '/Controllers/', type: 'controller', layer: 'api-controller' },
  { contains: '/Queries/', type: 'query', layer: 'application-request' },
  { contains: '/Commands/', type: 'command', layer: 'application-request' },
  { contains: '/Handlers/', type: 'handler', layer: 'application-handler' },
  { contains: '/DTOs/', type: 'dto', layer: 'hidden-dto' },
  { contains: '/Repositories/', type: 'auxiliary', layer: 'auxiliary' },
  { contains: '/Configurations/Entities/', type: 'auxiliary', layer: 'auxiliary' },
  { contains: '/Data/Context/', type: 'auxiliary', layer: 'auxiliary' },
  { contains: '/Entities/', type: 'entity', layer: 'domain' }
]

export function normalizeProjectMap(projectMap, configPath = null, { repoRoot = '.', toRepoPath } = {}) {
  return {
    ...projectMap,
    ...(configPath ? { configPath: toRepoPath(repoRoot, configPath) } : {}),
    project: normalizeProject(projectMap.project),
    sourceRoots: normalizeSourceRoots(projectMap.sourceRoots),
    templates: normalizeTemplates(projectMap.templates),
    ignoredDirs: normalizeIgnoredDirectories(projectMap.ignoredDirs),
    imports: normalizeImports(projectMap.imports),
    modules: normalizeModules(projectMap.modules),
    layers: normalizeLayers(projectMap.layers),
    types: normalizeTypes(projectMap.types),
    frontend: normalizeFrontend(projectMap.frontend),
    rules: normalizeRules(projectMap.rules),
    backend: normalizeBackend(projectMap.backend)
  }
}

function normalizeProject(project = {}) {
  return {
    name: project.name ?? 'Code Map',
    graphOutput: project.graphOutput ?? '.code-map/graph.json',
    submapsDirectory: project.submapsDirectory ?? '.code-map/submaps',
    ...(project.runtimeLinks ? { runtimeLinks: project.runtimeLinks } : {})
  }
}

function normalizeSourceRoots(sourceRoots = {}) {
  return { frontend: sourceRoots.frontend, ...(sourceRoots.backend ? { backend: sourceRoots.backend } : {}) }
}

function normalizeIgnoredDirectories(ignoredDirectories) {
  return ignoredDirectories ?? defaultIgnoredDirs
}

function normalizeImports(imports) {
  return { aliases: imports?.aliases ?? [] }
}

function normalizeLayers(layers) {
  return layers ?? []
}

function normalizeTypes(types) {
  return { labels: types?.labels ?? {}, colors: types?.colors ?? {} }
}

function normalizeRules(rules) {
  return { enabled: [], options: {}, ...rules }
}

function normalizeTemplates(templates) {
  return {
    enabled: [
      'filesystem',
      'typescript',
      'react',
      'architecture.feature-sliced',
      'architecture.mvvm',
      'http-endpoints',
      'csharp',
      'dotnet-api',
      'architecture.mvc',
      'architecture.clean-architecture',
      'architecture.cqrs',
      'entity-framework',
      'coverage',
      'quality'
    ],
    ...(templates ?? {})
  }
}

function normalizeModules(modules) {
  return {
    shared: 'shared',
    labels: {},
    utilityControllers: ['version', 'health', 'status', 'probe'],
    bootstrapStems: ['program', 'startup', 'dependencyinjection', 'servicecollectionextensions'],
    infrastructureFolders: defaultInfrastructureFolders,
    ...modules
  }
}

function normalizeFrontend(frontend) {
  return {
    classifiers: defaultFrontendClassifiers,
    entryPoints: [],
    coverableTypes: ['route', 'page', 'main-component', 'component', 'subcomponent', 'hook', 'service', 'repository'],
    componentMainNamePattern: 'Main$|Main[A-Z]|View$|Container$|Content$',
    featureFolderPattern: '/features/{module}/',
    ...frontend
  }
}

function normalizeBackend(backend) {
  return {
    classifiers: defaultBackendClassifiers,
    entryPointSuffixes: ['/Program.cs'],
    dtoPathFragment: '/DTOs/',
    controllerPathFragment: '/Controllers/',
    handlerPathFragment: '/Handlers/',
    repositoryPathFragment: '/Repositories/',
    entityConfigurationPathFragment: '/Configurations/Entities/',
    dataContextPathFragment: '/Data/Context/',
    entityPathFragment: '/Entities/',
    validatorPathFragment: '/Validators/',
    mappingPathFragment: '/Mappings/',
    ...backend
  }
}
