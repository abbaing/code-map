import fs from 'node:fs'
import path from 'node:path'

// ── Helpers ───────────────────────────────────────────────────────────────────

function exists(filePath) {
  return fs.existsSync(filePath)
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function readJsonWithComments(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    // Strip single-line and block comments, then trailing commas before } or ]
    const stripped = raw
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/,(\s*[}\]])/g, '$1')
    return JSON.parse(stripped)
  } catch {
    return null
  }
}

function extractTsconfigPaths(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    // Extract the paths block with a targeted regex instead of full JSON parse
    const pathsMatch = raw.match(/"paths"\s*:\s*\{([^}]+)\}/s)
    if (!pathsMatch) return {}
    const pathsBlock = pathsMatch[1]
    const result = {}
    for (const match of pathsBlock.matchAll(/"([^"]+)"\s*:\s*\[([^\]]+)\]/g)) {
      const key = match[1]
      const valMatch = match[2].match(/"([^"]+)"/)
      if (valMatch) result[key] = [valMatch[1]]
    }
    return result
  } catch {
    return {}
  }
}

function listDirs(dirPath) {
  if (!exists(dirPath)) return []
  try {
    return fs.readdirSync(dirPath).filter(name => {
      try { return fs.statSync(path.join(dirPath, name)).isDirectory() } catch { return false }
    })
  } catch {
    return []
  }
}

const DETECT_IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', 'bin', 'obj', '.cache'])

function globFirst(base, pattern) {
  try {
    const stack = [base]
    while (stack.length > 0) {
      const current = stack.pop()
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const fullPath = path.join(current, entry.name)
        if (entry.isDirectory()) {
          if (!DETECT_IGNORED_DIRS.has(entry.name)) stack.push(fullPath)
          continue
        }
        if (entry.isFile() && entry.name.endsWith(pattern)) return fullPath
      }
    }
  } catch { /* empty */ }
  return null
}

function normalizeSep(p) {
  return p.replaceAll('\\', '/')
}

function toRelative(base, target) {
  return normalizeSep(path.relative(base, target))
}

function titleCase(str) {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// ── Stack detection ───────────────────────────────────────────────────────────

const REACT_DEPS = ['react', 'react-dom']
const VUE_DEPS = ['vue']
const ANGULAR_DEPS = ['@angular/core']
const DOTNET_MARKER = '.csproj'
const GO_MARKER = 'go.mod'
const PYTHON_MARKER = 'requirements.txt'
const NODE_BACKEND_MARKERS = ['express', 'fastify', 'koa', 'hapi', 'nestjs', '@nestjs/core']

function detectFrontendFramework(pkg) {
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) }
  if (REACT_DEPS.some(d => deps[d])) return 'react'
  if (VUE_DEPS.some(d => deps[d])) return 'vue'
  if (ANGULAR_DEPS.some(d => deps[d])) return 'angular'
  return null
}

function detectBackendStack(repoRoot, backendRoot) {
  const backendPath = backendRoot ? path.join(repoRoot, backendRoot) : repoRoot
  if (globFirst(backendPath, DOTNET_MARKER) ?? globFirst(repoRoot, DOTNET_MARKER)) return 'dotnet'
  if (exists(path.join(repoRoot, GO_MARKER))) return 'go'
  if (exists(path.join(repoRoot, PYTHON_MARKER))) return 'python'
  const backendPkg = readJson(path.join(repoRoot, 'backend', 'package.json'))
    ?? readJson(path.join(repoRoot, 'server', 'package.json'))
    ?? readJson(path.join(repoRoot, 'api', 'package.json'))
  if (backendPkg) {
    const deps = { ...(backendPkg.dependencies ?? {}), ...(backendPkg.devDependencies ?? {}) }
    if (NODE_BACKEND_MARKERS.some(d => deps[d])) return 'node'
  }
  return null
}

// ── Source root detection ─────────────────────────────────────────────────────

export function detectSourceRoots(repoRoot) {
  const candidates = [
    { front: 'front/src', back: 'back' },
    { front: 'frontend/src', back: 'backend' },
    { front: 'client/src', back: 'server' },
    { front: 'web/src', back: 'api' },
    { front: 'app/src', back: 'api' },
    { front: 'src', back: null },
  ]

  for (const candidate of candidates) {
    if (exists(path.join(repoRoot, candidate.front))) {
      return {
        frontend: candidate.front,
        backend: candidate.back && exists(path.join(repoRoot, candidate.back)) ? candidate.back : null
      }
    }
  }

  return { frontend: 'src', backend: null }
}

// ── Alias detection ───────────────────────────────────────────────────────────

export function detectAliases(repoRoot, frontendRoot) {
  const frontDir = path.dirname(path.join(repoRoot, frontendRoot))
  const rawPaths = extractTsconfigPaths(path.join(frontDir, 'tsconfig.json'))
    ?? extractTsconfigPaths(path.join(frontDir, 'tsconfig.app.json'))
    ?? {}
  const aliases = []

  for (const [prefix, targets] of Object.entries(rawPaths)) {
    if (!Array.isArray(targets) || targets.length === 0) continue
    const target = targets[0]
    // "@/*" -> "@/"   "@components/*" -> "@components/"   "@foo" -> "@foo/"
    const cleanPrefix = prefix.endsWith('/*')
      ? prefix.slice(0, -1)           // remove the *
      : prefix.endsWith('*')
        ? prefix.slice(0, -1) + '/'   // remove * and add /
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

export function detectModules(repoRoot, frontendRoot, backendRoot) {
  const srcDir = path.join(repoRoot, frontendRoot)
  let featureFolder = null

  for (const candidate of FEATURE_FOLDER_NAMES) {
    if (exists(path.join(srcDir, candidate))) {
      featureFolder = candidate
      break
    }
  }

  const modules = featureFolder
    ? listDirs(path.join(srcDir, featureFolder))
    : listDirs(srcDir).filter(d => !INFRA_FOLDERS.has(d))

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
    const backDirs = listDirs(backDir)
    const projectFolders = backDirs.filter(d => !d.startsWith('.') && d !== 'node_modules')
    if (projectFolders.length > 0) {
      result.backendProjectFolderPattern = `^${backendRoot}/[^/]+/([^/]+)`
      result.backendControllerPattern = `^${backendRoot}/[^/]+/Controllers/(.+?)Controller\\.cs$`
      result.backendEntityDomainPattern = `^${backendRoot}/[^/]+/Entities/([^/]+)`
    }
  }

  return result
}

const INFRA_FOLDERS = new Set([
  'assets', 'behaviors', 'components', 'config', 'configurations', 'constants',
  'context', 'contracts', 'data', 'entities', 'exceptions', 'extensions',
  'helpers', 'hooks', 'interceptors', 'layouts', 'lib', 'middleware', 'middlewares',
  'migrations', 'models', 'repositories', 'routes', 'schemas', 'services',
  'specifications', 'stores', 'styles', 'test', 'types', 'utils', 'utilities',
  'validation', 'valueobjects', 'value-objects'
])

// ── Layer detection ───────────────────────────────────────────────────────────

const LAYER_PRESETS = {
  reactDotnetLayers: [
    { id: 'ui-route',             label: 'Routes' },
    { id: 'ui-page',              label: 'Pages' },
    { id: 'ui-main-component',    label: 'Main Components' },
    { id: 'ui-component-logic',   label: 'Components / Logic' },
    { id: 'front-service',        label: 'Frontend Services' },
    { id: 'front-repository',     label: 'Frontend Repositories' },
    { id: 'api-endpoint',         label: 'API Endpoints' },
    { id: 'api-controller',       label: 'Controllers' },
    { id: 'application-boundary', label: 'Handlers / Boundaries' },
    { id: 'domain',               label: 'Entities' },
    { id: 'database-table',       label: 'DB Tables' }
  ],
  reactApiLayers: [
    { id: 'ui-route',           label: 'Routes' },
    { id: 'ui-page',            label: 'Pages' },
    { id: 'ui-main-component',  label: 'Main Components' },
    { id: 'ui-component-logic', label: 'Components / Logic' },
    { id: 'front-service',      label: 'Frontend Services' },
    { id: 'front-repository',   label: 'Frontend Repositories' },
    { id: 'api-endpoint',       label: 'API Endpoints' },
    { id: 'api-controller',     label: 'Controllers' }
  ],
  reactUiLayers: [
    { id: 'ui-route',           label: 'Routes' },
    { id: 'ui-page',            label: 'Pages' },
    { id: 'ui-main-component',  label: 'Main Components' },
    { id: 'ui-component-logic', label: 'Components / Logic' },
    { id: 'front-service',      label: 'Services' },
    { id: 'front-repository',   label: 'Repositories' }
  ],
  fallbackLayers: [
    { id: 'ui-route',           label: 'Routes' },
    { id: 'ui-page',            label: 'Pages' },
    { id: 'ui-component-logic', label: 'Components' },
    { id: 'front-service',      label: 'Services' },
    { id: 'api-endpoint',       label: 'API Endpoints' }
  ]
}

export function detectLayers(frontendFramework, backendStack) {
  if (frontendFramework === 'react' && backendStack === 'dotnet') return LAYER_PRESETS.reactDotnetLayers
  if (frontendFramework === 'react' && (backendStack === 'node' || backendStack === 'go')) return LAYER_PRESETS.reactApiLayers
  if (frontendFramework === 'react' && !backendStack) return LAYER_PRESETS.reactUiLayers
  return LAYER_PRESETS.fallbackLayers
}

// ── Frontend config detection ─────────────────────────────────────────────────

const KNOWN_FOLDER_CLASSIFIERS = [
  { contains: '/routes/',       type: 'route',      layer: 'ui-route' },
  { contains: '/pages/',        type: 'page',        layer: 'ui-page' },
  { contains: '/hooks/',        type: 'hook',        layer: 'ui-component-logic' },
  { contains: '/services/',     type: 'service',     layer: 'front-service' },
  { contains: '/repositories/', type: 'repository',  layer: 'front-repository' },
  { contains: '/config/',       type: 'config',      layer: 'config' },
  { contains: '/stores/',       type: 'auxiliary',   layer: 'auxiliary' },
  { contains: '/types/',        type: 'auxiliary',   layer: 'auxiliary' },
  { contains: '/schemas/',      type: 'config',      layer: 'config' },
  { contains: '/utils/',        type: 'auxiliary',   layer: 'auxiliary' },
  { contains: '/lib/',          type: 'auxiliary',   layer: 'auxiliary' }
]

export function detectFrontend(repoRoot, frontendRoot) {
  const srcDir = path.join(repoRoot, frontendRoot)
  const entryPoints = []

  for (const candidate of ['App.tsx', 'App.ts', 'App.jsx', 'main.tsx', 'main.ts', 'main.jsx', 'index.tsx', 'index.ts']) {
    const full = path.join(srcDir, candidate)
    if (exists(full)) {
      entryPoints.push(toRelative(repoRoot, full))
      break
    }
  }

  const routesEntry = path.join(srcDir, 'routes')
  if (exists(routesEntry)) {
    const routeFile = ['AppRoutes/index.tsx', 'AppRoutes.tsx', 'index.tsx']
      .map(f => path.join(routesEntry, f))
      .find(exists)
    if (routeFile) entryPoints.push(toRelative(repoRoot, routeFile))
  }

  const featureFolder = FEATURE_FOLDER_NAMES.find(f => exists(path.join(srcDir, f)))
  const featureFolderPattern = featureFolder
    ? `/${featureFolder}/{module}/`
    : '/features/{module}/'

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
    { contains: '/Controllers/',            type: 'controller', layer: 'api-controller' },
    { contains: '/Queries/',                type: 'query',      layer: 'application-boundary' },
    { contains: '/Commands/',               type: 'command',    layer: 'application-boundary' },
    { contains: '/Handlers/',               type: 'handler',    layer: 'application-boundary' },
    { contains: '/DTOs/',                   type: 'dto',        layer: 'hidden-dto' },
    { contains: '/Repositories/',           type: 'auxiliary',  layer: 'auxiliary' },
    { contains: '/Configurations/Entities/',type: 'auxiliary',  layer: 'auxiliary' },
    { contains: '/Data/Context/',           type: 'auxiliary',  layer: 'auxiliary' },
    { contains: '/Entities/',               type: 'entity',     layer: 'domain' }
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
    { contains: '/handlers/',    type: 'handler',    layer: 'application-boundary' },
    { contains: '/repositories/',type: 'auxiliary',  layer: 'auxiliary' },
    { contains: '/entities/',    type: 'entity',     layer: 'domain' }
  ]
}

export function detectBackend(repoRoot, backendRoot, backendStack) {
  if (!backendRoot || !backendStack) return null
  if (backendStack === 'dotnet') return DOTNET_DEFAULTS
  if (backendStack === 'node') return NODE_BACKEND_DEFAULTS
  return null
}

// ── Types config ──────────────────────────────────────────────────────────────

const DEFAULT_TYPES = {
  labels: {
    auxiliary: 'Auxiliary', command: 'Command', component: 'Component',
    controller: 'Controller', endpoint: 'API Endpoint', entity: 'Entity',
    handler: 'Handler', hook: 'Hook', 'main-component': 'Main Component',
    page: 'Page', query: 'Query', repository: 'Repository',
    route: 'Route', service: 'Service', store: 'Store',
    subcomponent: 'Subcomponent', table: 'DB Table'
  },
  colors: {
    route: '#7c3aed', page: '#0891b2', 'main-component': '#0891b2',
    component: '#0891b2', subcomponent: '#0891b2', hook: '#2563eb',
    service: '#2563eb', repository: '#2563eb', endpoint: '#c2410c',
    controller: '#c2410c', query: '#15803d', command: '#15803d',
    handler: '#15803d', entity: '#9333ea', table: '#9333ea',
    auxiliary: '#94a3b8', store: '#64748b'
  }
}

// ── Project detection ─────────────────────────────────────────────────────────

export function detectProject(repoRoot) {
  const pkg = readJson(path.join(repoRoot, 'front', 'package.json'))
    ?? readJson(path.join(repoRoot, 'frontend', 'package.json'))
    ?? readJson(path.join(repoRoot, 'client', 'package.json'))
    ?? readJson(path.join(repoRoot, 'package.json'))

  const rawName = pkg?.name ?? path.basename(repoRoot)
  const name = titleCase(rawName.replace(/^@[^/]+\//, ''))

  return {
    name,
    graphOutput: 'graph.json',
    runtimeLinks: 'runtime-links.json'
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function detect(repoRoot) {
  const { frontend: frontendRoot, backend: backendRoot } = detectSourceRoots(repoRoot)

  const frontendPkgDir = path.dirname(path.join(repoRoot, frontendRoot))
  const frontendPkg = readJson(path.join(frontendPkgDir, 'package.json'))
    ?? readJson(path.join(repoRoot, 'package.json'))

  const frontendFramework = detectFrontendFramework(frontendPkg)
  const backendStack = backendRoot ? detectBackendStack(repoRoot, backendRoot) : null

  const project = detectProject(repoRoot)
  const aliases = detectAliases(repoRoot, frontendRoot)
  const modules = detectModules(repoRoot, frontendRoot, backendRoot)
  const layers = detectLayers(frontendFramework, backendStack)
  const frontend = detectFrontend(repoRoot, frontendRoot)
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
        ...(backendStack === 'dotnet' ? ['dotnet-api', 'architecture.mvc', 'architecture.clean-architecture', 'architecture.cqrs', 'entity-framework'] : []),
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

export function detectSummary(repoRoot) {
  const { frontend: frontendRoot, backend: backendRoot } = detectSourceRoots(repoRoot)
  const frontendPkgDir = path.dirname(path.join(repoRoot, frontendRoot))
  const frontendPkg = readJson(path.join(frontendPkgDir, 'package.json'))
    ?? readJson(path.join(repoRoot, 'package.json'))
  const frontendFramework = detectFrontendFramework(frontendPkg)
  const backendStack = backendRoot ? detectBackendStack(repoRoot, backendRoot) : null
  const modules = detectModules(repoRoot, frontendRoot, backendRoot)

  return {
    frontendRoot,
    backendRoot,
    frontendFramework,
    backendStack,
    moduleCount: Object.keys(modules.labels).length
  }
}
