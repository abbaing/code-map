import path from 'node:path'
import {
  extractTsconfigPaths,
  listDirectories,
  normalizeSeparator,
  toRelative,
  titleCase
} from '#core/detection-files.mjs'

const featureFolders = ['features', 'modules', 'domains', 'pages', 'views']
const infrastructureFolders = new Set([
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

export function detectSourceRoots(repoRoot, files) {
  const candidates = [
    ['front/src', 'back'],
    ['frontend/src', 'backend'],
    ['client/src', 'server'],
    ['web/src', 'api'],
    ['app/src', 'api'],
    ['src', null]
  ]
  const match = candidates.find(([frontend]) => files.exists(path.join(repoRoot, frontend)))
  if (!match) {
    return { frontend: 'src', backend: null }
  }
  const [frontend, backend] = match
  return { frontend, backend: backend && files.exists(path.join(repoRoot, backend)) ? backend : null }
}

export function detectAliases(repoRoot, frontendRoot, files) {
  const frontendDirectory = path.dirname(path.join(repoRoot, frontendRoot))
  const rawPaths = readCompilerPaths(frontendDirectory, files)
  return Object.entries(rawPaths)
    .filter(([, targets]) => Array.isArray(targets) && targets.length > 0)
    .map(([prefix, [target]]) => normalizeAlias(repoRoot, frontendDirectory, prefix, target))
}

export function detectModules(repoRoot, frontendRoot, backendRoot, files) {
  const sourceDirectory = path.join(repoRoot, frontendRoot)
  const featureFolder = featureFolders.find((candidate) => files.exists(path.join(sourceDirectory, candidate)))
  const modules = featureFolder
    ? listDirectories(path.join(sourceDirectory, featureFolder), files)
    : listDirectories(sourceDirectory, files).filter((name) => !infrastructureFolders.has(name))
  const result = createModuleConfig(frontendRoot, featureFolder, modules)
  if (backendRoot) {
    addBackendPatterns(result, repoRoot, backendRoot, files)
  }
  return result
}

function readCompilerPaths(directory, files) {
  return (
    extractTsconfigPaths(path.join(directory, 'tsconfig.json'), files) ??
    extractTsconfigPaths(path.join(directory, 'tsconfig.app.json'), files)
  )
}

function normalizeAlias(repoRoot, frontendDirectory, prefix, target) {
  const cleanPrefix = prefix.endsWith('/*') ? prefix.slice(0, -1) : normalizeAliasPrefix(prefix)
  const cleanTarget = target.replace(/^\.\//, '').replace(/\/\*$/, '')
  const relativeDirectory = path.relative(repoRoot, frontendDirectory)
  return { prefix: cleanPrefix, path: normalizeSeparator(path.join(relativeDirectory, cleanTarget)) }
}

function normalizeAliasPrefix(prefix) {
  if (prefix.endsWith('*')) {
    return `${prefix.slice(0, -1)}/`
  }
  return prefix.endsWith('/') ? prefix : `${prefix}/`
}

function createModuleConfig(frontendRoot, featureFolder, modules) {
  return {
    shared: 'shared',
    frontendFeaturePattern: featureFolder ? `^${frontendRoot}/${featureFolder}/([^/]+)` : `^${frontendRoot}/([^/]+)`,
    labels: Object.fromEntries(modules.map((name) => [name, titleCase(name)])),
    utilityControllers: ['version', 'health', 'status', 'probe'],
    bootstrapStems: ['program', 'startup', 'dependencyinjection', 'servicecollectionextensions'],
    infrastructureFolders: [...infrastructureFolders]
  }
}

function addBackendPatterns(result, repoRoot, backendRoot, files) {
  const projects = listDirectories(path.join(repoRoot, backendRoot), files).filter(
    (name) => !name.startsWith('.') && name !== 'node_modules'
  )
  if (projects.length === 0) {
    return
  }
  result.backendProjectFolderPattern = `^${backendRoot}/[^/]+/([^/]+)`
  result.backendControllerPattern = `^${backendRoot}/[^/]+/Controllers/(.+?)Controller\\.cs$`
  result.backendEntityDomainPattern = `^${backendRoot}/[^/]+/Entities/([^/]+)`
}

export function detectFrontend(repoRoot, frontendRoot, files) {
  const sourceDirectory = path.join(repoRoot, frontendRoot)
  const entryPoints = detectEntryPoints(repoRoot, sourceDirectory, files)
  const featureFolder = featureFolders.find((candidate) => files.exists(path.join(sourceDirectory, candidate)))
  return {
    featureFolderPattern: featureFolder ? `/${featureFolder}/{module}/` : '/features/{module}/',
    entryPoints,
    componentMainNamePattern: 'Main$|Main[A-Z]|View$|Container$|Content$',
    classifiers: frontendClassifiers,
    coverableTypes: ['route', 'page', 'main-component', 'component', 'subcomponent', 'hook', 'service', 'repository']
  }
}

function detectEntryPoints(repoRoot, sourceDirectory, files) {
  const candidates = ['App.tsx', 'App.ts', 'App.jsx', 'main.tsx', 'main.ts', 'main.jsx', 'index.tsx', 'index.ts']
  const entryPoints = candidates
    .map((name) => path.join(sourceDirectory, name))
    .filter((file) => files.exists(file))
    .slice(0, 1)
    .map((file) => toRelative(repoRoot, file))
  const routeDirectory = path.join(sourceDirectory, 'routes')
  if (!files.exists(routeDirectory)) {
    return entryPoints
  }
  const route = ['AppRoutes/index.tsx', 'AppRoutes.tsx', 'index.tsx']
    .map((name) => path.join(routeDirectory, name))
    .find((file) => files.exists(file))
  if (route) {
    entryPoints.push(toRelative(repoRoot, route))
  }
  return entryPoints
}

const frontendClassifiers = [
  ['/routes/', 'route', 'ui-route'],
  ['/pages/', 'page', 'ui-page'],
  ['/hooks/', 'hook', 'ui-component-logic'],
  ['/services/', 'service', 'front-service'],
  ['/repositories/', 'repository', 'front-repository'],
  ['/config/', 'config', 'config'],
  ['/stores/', 'auxiliary', 'auxiliary'],
  ['/types/', 'auxiliary', 'auxiliary'],
  ['/schemas/', 'config', 'config'],
  ['/utils/', 'auxiliary', 'auxiliary'],
  ['/lib/', 'auxiliary', 'auxiliary']
].map(([contains, type, layer]) => ({ contains, type, layer }))
