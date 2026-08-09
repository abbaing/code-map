import path from 'node:path'

// ── Helpers ───────────────────────────────────────────────────────────────────

export function createDetectionFiles(fileSystem) {
  if (
    !fileSystem ||
    typeof fileSystem.exists !== 'function' ||
    typeof fileSystem.readText !== 'function' ||
    typeof fileSystem.readDirectory !== 'function' ||
    typeof fileSystem.stat !== 'function'
  ) {
    throw new TypeError('ProjectDetector requires bounded filesystem capabilities.')
  }
  return Object.freeze({
    exists: (filePath) => fileSystem.exists(filePath),
    readText: (filePath) => fileSystem.readText(filePath),
    readDirectory: (directory, options) => fileSystem.readDirectory(directory, options),
    stat: (filePath) => fileSystem.stat(filePath)
  })
}

function readJson(filePath, files) {
  try {
    return JSON.parse(files.readText(filePath))
  } catch {
    return null
  }
}

function extractTsconfigPaths(filePath, files) {
  try {
    const raw = files.readText(filePath)
    // Extract the paths block with a targeted regex instead of full JSON parse
    const pathsMatch = raw.match(/"paths"\s*:\s*\{([^}]+)\}/s)
    if (!pathsMatch) {
      return {}
    }
    const pathsBlock = pathsMatch[1]
    const result = {}
    for (const match of pathsBlock.matchAll(/"([^"]+)"\s*:\s*\[([^\]]+)\]/g)) {
      const key = match[1]
      const valMatch = match[2].match(/"([^"]+)"/)
      if (valMatch) {
        result[key] = [valMatch[1]]
      }
    }
    return result
  } catch {
    return {}
  }
}

function listDirs(dirPath, files) {
  if (!files.exists(dirPath)) {
    return []
  }
  try {
    return files.readDirectory(dirPath).filter((name) => {
      try {
        return files.stat(path.join(dirPath, name)).isDirectory()
      } catch {
        return false
      }
    })
  } catch {
    return []
  }
}

const DETECT_IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', 'bin', 'obj', '.cache'])

function globFirst(base, pattern, files) {
  try {
    const stack = [base]
    while (stack.length > 0) {
      const current = stack.pop()
      for (const entry of files.readDirectory(current, { withFileTypes: true })) {
        const fullPath = path.join(current, entry.name)
        if (entry.isDirectory()) {
          if (!DETECT_IGNORED_DIRS.has(entry.name)) {
            stack.push(fullPath)
          }
          continue
        }
        if (entry.isFile() && entry.name.endsWith(pattern)) {
          return fullPath
        }
      }
    }
  } catch {
    /* empty */
  }
  return null
}

function normalizeSep(p) {
  return p.replaceAll('\\', '/')
}

function toRelative(base, target) {
  return normalizeSep(path.relative(base, target))
}

function titleCase(str) {
  return str.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ── Stack detection ───────────────────────────────────────────────────────────

const REACT_DEPS = ['react', 'react-dom']
const VUE_DEPS = ['vue']
const ANGULAR_DEPS = ['@angular/core']
const DOTNET_MARKER = '.csproj'
const GO_MARKER = 'go.mod'
const PYTHON_MARKER = 'requirements.txt'
const NODE_BACKEND_MARKERS = ['express', 'fastify', 'koa', 'hapi', 'nestjs', '@nestjs/core']

function detectFrontendFramework(pkg, detectors) {
  const context = { dependencies: { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) } }
  for (const detector of detectors.frontend) {
    if (detector.detect(context)) {
      return detector.id
    }
  }
  return null
}

export function createStackDetectorRegistry({
  frontend = defaultFrontendDetectors,
  backend = defaultBackendDetectors
} = {}) {
  return Object.freeze({
    frontend: validateDetectors(frontend, 'frontend'),
    backend: validateDetectors(backend, 'backend')
  })
}

const defaultFrontendDetectors = [
  dependencyDetector('react', REACT_DEPS),
  dependencyDetector('vue', VUE_DEPS),
  dependencyDetector('angular', ANGULAR_DEPS)
]

const defaultBackendDetectors = [
  {
    id: 'dotnet',
    detect: ({ backendPath, repoRoot, files }) =>
      Boolean(globFirst(backendPath, DOTNET_MARKER, files) ?? globFirst(repoRoot, DOTNET_MARKER, files))
  },
  { id: 'go', detect: ({ repoRoot, files }) => files.exists(path.join(repoRoot, GO_MARKER)) },
  { id: 'python', detect: ({ repoRoot, files }) => files.exists(path.join(repoRoot, PYTHON_MARKER)) },
  {
    id: 'node',
    detect: ({ backendPkg }) => {
      const dependencies = { ...(backendPkg?.dependencies ?? {}), ...(backendPkg?.devDependencies ?? {}) }
      return NODE_BACKEND_MARKERS.some((dependency) => dependencies[dependency])
    }
  }
]

function dependencyDetector(id, dependencies) {
  return { id, detect: (context) => dependencies.some((dependency) => context.dependencies[dependency]) }
}

function validateDetectors(detectors, kind) {
  if (!Array.isArray(detectors)) {
    throw new TypeError(`${kind} detectors must be an array.`)
  }
  const ids = new Set()
  return Object.freeze(
    detectors.map((detector) => {
      if (!detector || typeof detector.id !== 'string' || typeof detector.detect !== 'function') {
        throw new TypeError(`${kind} detectors must declare id and detect(context).`)
      }
      if (ids.has(detector.id)) {
        throw new TypeError(`Duplicate ${kind} detector id: ${detector.id}.`)
      }
      ids.add(detector.id)
      return Object.freeze({ id: detector.id, detect: detector.detect.bind(detector) })
    })
  )
}

function detectBackendStack(repoRoot, backendRoot, files, detectors) {
  const backendPath = backendRoot ? path.join(repoRoot, backendRoot) : repoRoot
  const backendPkg =
    readJson(path.join(repoRoot, 'backend', 'package.json'), files) ??
    readJson(path.join(repoRoot, 'server', 'package.json'), files) ??
    readJson(path.join(repoRoot, 'api', 'package.json'), files)
  const context = { repoRoot, backendPath, backendPkg, files }
  for (const detector of detectors.backend) {
    if (detector.detect(context)) {
      return detector.id
    }
  }
  return null
}

// ── Source root detection ─────────────────────────────────────────────────────

export function detectSourceRoots(repoRoot, files) {
  const candidates = [
    { front: 'front/src', back: 'back' },
    { front: 'frontend/src', back: 'backend' },
    { front: 'client/src', back: 'server' },
    { front: 'web/src', back: 'api' },
    { front: 'app/src', back: 'api' },
    { front: 'src', back: null }
  ]

  for (const candidate of candidates) {
    if (files.exists(path.join(repoRoot, candidate.front))) {
      return {
        frontend: candidate.front,
        backend: candidate.back && files.exists(path.join(repoRoot, candidate.back)) ? candidate.back : null
      }
    }
  }

  return { frontend: 'src', backend: null }
}

// ── Alias detection ───────────────────────────────────────────────────────────

export function detectAliases(repoRoot, frontendRoot, files) {
  const frontDir = path.dirname(path.join(repoRoot, frontendRoot))
  const rawPaths =
    extractTsconfigPaths(path.join(frontDir, 'tsconfig.json'), files) ??
    extractTsconfigPaths(path.join(frontDir, 'tsconfig.app.json'), files) ??
    {}
  const aliases = []

  for (const [prefix, targets] of Object.entries(rawPaths)) {
    if (!Array.isArray(targets) || targets.length === 0) {
      continue
    }
    const target = targets[0]
    // "@/*" -> "@/"   "@components/*" -> "@components/"   "@foo" -> "@foo/"
    const cleanPrefix = prefix.endsWith('/*')
      ? prefix.slice(0, -1) // remove the *
      : prefix.endsWith('*')
        ? prefix.slice(0, -1) + '/' // remove * and add /
        : prefix.endsWith('/')
          ? prefix
          : prefix + '/'
    const cleanTarget = target.replace(/^\.\//, '').replace(/\/\*$/, '')
    const resolvedTarget = normalizeSep(path.join(path.relative(repoRoot, frontDir), cleanTarget))
    aliases.push({ prefix: cleanPrefix, path: resolvedTarget })
  }

  return aliases
}

// ── Module detection ──────────────────────────────────────────────────────────

const FEATURE_FOLDER_NAMES = ['features', 'modules', 'domains', 'pages', 'views']

export function detectModules(repoRoot, frontendRoot, backendRoot, files) {
  const srcDir = path.join(repoRoot, frontendRoot)
  let featureFolder = null

  for (const candidate of FEATURE_FOLDER_NAMES) {
    if (files.exists(path.join(srcDir, candidate))) {
      featureFolder = candidate
      break
    }
  }

  const modules = featureFolder
    ? listDirs(path.join(srcDir, featureFolder), files)
    : listDirs(srcDir, files).filter((d) => !INFRA_FOLDERS.has(d))

  const labels = {}
  for (const mod of modules) {
    labels[mod] = titleCase(mod)
  }

  const frontendFeaturePattern = featureFolder
    ? `^${frontendRoot}/${featureFolder}/([^/]+)`
    : `^${frontendRoot}/([^/]+)`

  const result = {
    shared: 'shared',
    frontendFeaturePattern,
    labels,
    utilityControllers: ['version', 'health', 'status', 'probe'],
    bootstrapStems: ['program', 'startup', 'dependencyinjection', 'servicecollectionextensions'],
    infrastructureFolders: [...INFRA_FOLDERS]
  }

  if (backendRoot) {
    const backDir = path.join(repoRoot, backendRoot)
    const backDirs = listDirs(backDir, files)
    const projectFolders = backDirs.filter((d) => !d.startsWith('.') && d !== 'node_modules')
    if (projectFolders.length > 0) {
      result.backendProjectFolderPattern = `^${backendRoot}/[^/]+/([^/]+)`
      result.backendControllerPattern = `^${backendRoot}/[^/]+/Controllers/(.+?)Controller\\.cs$`
      result.backendEntityDomainPattern = `^${backendRoot}/[^/]+/Entities/([^/]+)`
    }
  }

  return result
}

const INFRA_FOLDERS = new Set([
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
  'types',
  'utils',
  'utilities',
  'validation',
  'valueobjects',
  'value-objects'
])

// ── Layer detection ───────────────────────────────────────────────────────────

const LAYER_PRESETS = {
  reactDotnetLayers: [
    { id: 'ui-route', label: 'Routes' },
    { id: 'ui-page', label: 'Pages' },
    { id: 'ui-main-component', label: 'Main Components' },
    { id: 'ui-component-logic', label: 'Components / Logic' },
    { id: 'front-service', label: 'Frontend Services' },
    { id: 'front-repository', label: 'Frontend Repositories' },
    { id: 'api-endpoint', label: 'API Endpoints' },
    { id: 'api-controller', label: 'Controllers' },
    { id: 'application-request', label: 'Commands & Queries' },
    { id: 'application-handler', label: 'Handlers' },
    { id: 'backend-service', label: 'Backend Services' },
    { id: 'backend-repository', label: 'Persistence Repositories' },
    { id: 'domain', label: 'Entities' },
    { id: 'database-table', label: 'DB Tables' }
  ],
  reactApiLayers: [
    { id: 'ui-route', label: 'Routes' },
    { id: 'ui-page', label: 'Pages' },
    { id: 'ui-main-component', label: 'Main Components' },
    { id: 'ui-component-logic', label: 'Components / Logic' },
    { id: 'front-service', label: 'Frontend Services' },
    { id: 'front-repository', label: 'Frontend Repositories' },
    { id: 'api-endpoint', label: 'API Endpoints' },
    { id: 'api-controller', label: 'Controllers' }
  ],
  reactUiLayers: [
    { id: 'ui-route', label: 'Routes' },
    { id: 'ui-page', label: 'Pages' },
    { id: 'ui-main-component', label: 'Main Components' },
    { id: 'ui-component-logic', label: 'Components / Logic' },
    { id: 'front-service', label: 'Services' },
    { id: 'front-repository', label: 'Repositories' }
  ],
  fallbackLayers: [
    { id: 'ui-route', label: 'Routes' },
    { id: 'ui-page', label: 'Pages' },
    { id: 'ui-component-logic', label: 'Components' },
    { id: 'front-service', label: 'Services' },
    { id: 'api-endpoint', label: 'API Endpoints' }
  ]
}

export function detectLayers(frontendFramework, backendStack) {
  if (frontendFramework === 'react' && backendStack === 'dotnet') {
    return LAYER_PRESETS.reactDotnetLayers
  }
  if (frontendFramework === 'react' && (backendStack === 'node' || backendStack === 'go')) {
    return LAYER_PRESETS.reactApiLayers
  }
  if (frontendFramework === 'react' && !backendStack) {
    return LAYER_PRESETS.reactUiLayers
  }
  return LAYER_PRESETS.fallbackLayers
}

// ── Frontend config detection ─────────────────────────────────────────────────

const KNOWN_FOLDER_CLASSIFIERS = [
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

export function detectFrontend(repoRoot, frontendRoot, files) {
  const srcDir = path.join(repoRoot, frontendRoot)
  const entryPoints = []

  for (const candidate of [
    'App.tsx',
    'App.ts',
    'App.jsx',
    'main.tsx',
    'main.ts',
    'main.jsx',
    'index.tsx',
    'index.ts'
  ]) {
    const full = path.join(srcDir, candidate)
    if (files.exists(full)) {
      entryPoints.push(toRelative(repoRoot, full))
      break
    }
  }

  const routesEntry = path.join(srcDir, 'routes')
  if (files.exists(routesEntry)) {
    const routeFile = ['AppRoutes/index.tsx', 'AppRoutes.tsx', 'index.tsx']
      .map((f) => path.join(routesEntry, f))
      .find((file) => files.exists(file))
    if (routeFile) {
      entryPoints.push(toRelative(repoRoot, routeFile))
    }
  }

  const featureFolder = FEATURE_FOLDER_NAMES.find((f) => files.exists(path.join(srcDir, f)))
  const featureFolderPattern = featureFolder ? `/${featureFolder}/{module}/` : '/features/{module}/'

  return {
    featureFolderPattern,
    entryPoints,
    componentMainNamePattern: 'Main$|Main[A-Z]|View$|Container$|Content$',
    classifiers: KNOWN_FOLDER_CLASSIFIERS,
    coverableTypes: ['route', 'page', 'main-component', 'component', 'subcomponent', 'hook', 'service', 'repository']
  }
}

// ── Backend config detection ──────────────────────────────────────────────────

const DOTNET_DEFAULTS = {
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
}

const NODE_BACKEND_DEFAULTS = {
  entryPointSuffixes: ['/index.js', '/index.ts', '/server.js', '/server.ts', '/app.js', '/app.ts'],
  dtoPathFragment: '/dto/',
  controllerPathFragment: '/controllers/',
  handlerPathFragment: '/handlers/',
  repositoryPathFragment: '/repositories/',
  entityPathFragment: '/entities/',
  classifiers: [
    { contains: '/controllers/', type: 'controller', layer: 'api-controller' },
    { contains: '/handlers/', type: 'handler', layer: 'application-handler' },
    { contains: '/repositories/', type: 'auxiliary', layer: 'auxiliary' },
    { contains: '/entities/', type: 'entity', layer: 'domain' }
  ]
}

export function detectBackend(repoRoot, backendRoot, backendStack) {
  if (!backendRoot || !backendStack) {
    return null
  }
  if (backendStack === 'dotnet') {
    return DOTNET_DEFAULTS
  }
  if (backendStack === 'node') {
    return NODE_BACKEND_DEFAULTS
  }
  return null
}

// ── Types config ──────────────────────────────────────────────────────────────

const DEFAULT_TYPES = {
  labels: {
    auxiliary: 'Auxiliary',
    command: 'Command',
    component: 'Component',
    controller: 'Controller',
    endpoint: 'API Endpoint',
    entity: 'Entity',
    handler: 'Handler',
    hook: 'Hook',
    'main-component': 'Main Component',
    page: 'Page',
    query: 'Query',
    repository: 'Repository',
    route: 'Route',
    service: 'Service',
    store: 'Store',
    subcomponent: 'Subcomponent',
    table: 'DB Table'
  },
  colors: {
    route: '#7c3aed',
    page: '#0891b2',
    'main-component': '#0891b2',
    component: '#0891b2',
    subcomponent: '#0891b2',
    hook: '#2563eb',
    service: '#2563eb',
    repository: '#2563eb',
    endpoint: '#c2410c',
    controller: '#c2410c',
    query: '#15803d',
    command: '#15803d',
    handler: '#15803d',
    entity: '#9333ea',
    table: '#9333ea',
    auxiliary: '#94a3b8',
    store: '#64748b'
  }
}

// ── Project detection ─────────────────────────────────────────────────────────

export function detectProject(repoRoot, files) {
  const pkg =
    readJson(path.join(repoRoot, 'front', 'package.json'), files) ??
    readJson(path.join(repoRoot, 'frontend', 'package.json'), files) ??
    readJson(path.join(repoRoot, 'client', 'package.json'), files) ??
    readJson(path.join(repoRoot, 'package.json'), files)

  const rawName = pkg?.name ?? path.basename(repoRoot)
  const name = titleCase(rawName.replace(/^@[^/]+\//, ''))

  return {
    name,
    graphOutput: '.code-map/graph.json',
    submapsDirectory: '.code-map/submaps'
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function detect(repoRoot, { files, detectors = createStackDetectorRegistry() } = {}) {
  assertDetectionFiles(files)
  const { frontend: frontendRoot, backend: backendRoot } = detectSourceRoots(repoRoot, files)

  const frontendPkgDir = path.dirname(path.join(repoRoot, frontendRoot))
  const frontendPkg =
    readJson(path.join(frontendPkgDir, 'package.json'), files) ?? readJson(path.join(repoRoot, 'package.json'), files)

  const frontendFramework = detectFrontendFramework(frontendPkg, detectors)
  const backendStack = backendRoot ? detectBackendStack(repoRoot, backendRoot, files, detectors) : null

  const project = detectProject(repoRoot, files)
  const aliases = detectAliases(repoRoot, frontendRoot, files)
  const modules = detectModules(repoRoot, frontendRoot, backendRoot, files)
  const layers = detectLayers(frontendFramework, backendStack)
  const frontend = detectFrontend(repoRoot, frontendRoot, files)
  const backend = detectBackend(repoRoot, backendRoot, backendStack)

  const config = {
    schemaVersion: 1,
    project,
    sourceRoots: {
      frontend: frontendRoot,
      ...(backendRoot ? { backend: backendRoot } : {})
    },
    templates: {
      enabled: [
        'filesystem',
        'typescript',
        ...(frontendFramework === 'react' ? ['react', 'architecture.feature-sliced', 'architecture.mvvm'] : []),
        'http-endpoints',
        ...(backendStack === 'dotnet'
          ? [
              'dotnet-api',
              'architecture.mvc',
              'architecture.clean-architecture',
              'architecture.cqrs',
              'entity-framework'
            ]
          : []),
        'coverage',
        'quality'
      ]
    },
    ignoredDirs: ['node_modules', 'dist', 'build', 'coverage', 'bin', 'obj', '.git'],
    imports: { aliases },
    modules,
    layers,
    types: DEFAULT_TYPES,
    frontend,
    rules: {
      enabled: [
        'technology.typescript.relative-imports',
        'technology.typescript.no-any',
        'framework.react.component-max-lines',
        'framework.react.route-file-shape'
      ],
      options: {
        'framework.react.component-max-lines': { max: 200 }
      },
      suppressions: []
    },
    ...(backend ? { backend } : {})
  }

  return config
}

export function detectSummary(repoRoot, { files, detectors = createStackDetectorRegistry() } = {}) {
  assertDetectionFiles(files)
  const { frontend: frontendRoot, backend: backendRoot } = detectSourceRoots(repoRoot, files)
  const frontendPkgDir = path.dirname(path.join(repoRoot, frontendRoot))
  const frontendPkg =
    readJson(path.join(frontendPkgDir, 'package.json'), files) ?? readJson(path.join(repoRoot, 'package.json'), files)
  const frontendFramework = detectFrontendFramework(frontendPkg, detectors)
  const backendStack = backendRoot ? detectBackendStack(repoRoot, backendRoot, files, detectors) : null
  const modules = detectModules(repoRoot, frontendRoot, backendRoot, files)

  return {
    frontendRoot,
    backendRoot,
    frontendFramework,
    backendStack,
    moduleCount: Object.keys(modules.labels).length
  }
}

function assertDetectionFiles(files) {
  if (!files || typeof files.exists !== 'function' || typeof files.readText !== 'function') {
    throw new TypeError('ProjectDetector requires detection files.')
  }
}
