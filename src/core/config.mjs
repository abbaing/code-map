import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertPlatform } from '#platform/contracts.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const defaultProjectMapPath = path.join(__dirname, 'presets/starter.project-map.json')

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

function findLocalProjectMapPath(cwd, fileSystem) {
  for (const directory of [cwd, path.join(cwd, '.code-map')]) {
    try {
      const files = fileSystem.readDirectory(directory)
      const exact = files.find((file) => file === 'project-map.json')
      if (exact) {
        return path.join(directory, exact)
      }
      const named = files.find((file) => file.endsWith('.project-map.json'))
      if (named) {
        return path.join(directory, named)
      }
    } catch {
      /* directory does not exist or is not readable */
    }
  }
  return null
}

export function getConfigPathFromArgs(argv, { cwd, configPath, fileSystem } = {}) {
  if (!Array.isArray(argv) || !cwd) {
    throw new TypeError('Config discovery requires argument and working-directory inputs.')
  }
  const configArgIndex = argv.indexOf('--config')
  if (configArgIndex >= 0 && argv[configArgIndex + 1]) {
    return path.resolve(cwd, argv[configArgIndex + 1])
  }
  if (configPath) {
    return path.resolve(cwd, configPath)
  }
  if (!fileSystem) {
    throw new TypeError('Config discovery requires a filesystem capability.')
  }
  return findLocalProjectMapPath(cwd, fileSystem)
}

export function loadProjectContext(
  source,
  { platform: providedPlatform, repoRoot: providedRoot, argv: providedArgs, configPath: environmentConfigPath } = {}
) {
  const platform = assertPlatform(providedPlatform)
  const projectRoot = providedRoot ?? platform.environment.cwd()
  const argv = providedArgs ?? platform.environment.args()
  const configSource =
    source ??
    getConfigPathFromArgs(argv, {
      cwd: projectRoot,
      configPath: environmentConfigPath ?? platform.environment.variable('CODE_MAP_CONFIG'),
      fileSystem: platform.fileSystem
    })
  if (configSource && typeof configSource === 'object') {
    return createProjectContext(configSource, { repoRoot: projectRoot, platform })
  }
  if (!configSource) {
    throw new Error('No project-map.json found. Run code-map --init or pass --config <path>.')
  }
  const resolvedPath = path.resolve(projectRoot, configSource)
  let parsed
  try {
    parsed = JSON.parse(platform.fileSystem.readText(resolvedPath))
  } catch (err) {
    throw new Error(`Failed to read project map at ${relativeProjectPath(projectRoot, resolvedPath)}: ${err.message}`)
  }
  return createProjectContext(parsed, { repoRoot: projectRoot, configPath: resolvedPath, platform })
}

export function createProjectContext(
  projectMap,
  { repoRoot: projectRoot = '.', configPath = null, platform: providedPlatform } = {}
) {
  const platform = assertPlatform(providedPlatform)
  const root = path.resolve(projectRoot)
  const resolvedConfigPath = configPath ? path.resolve(root, configPath) : null
  validateProjectMap(projectMap, resolvedConfigPath ?? defaultProjectMapPath, { repoRoot: root })
  const normalizedProjectMap = deepFreeze(
    structuredClone(normalizeProjectMap(projectMap, resolvedConfigPath, { repoRoot: root }))
  )

  return Object.freeze({
    repoRoot: root,
    configPath: resolvedConfigPath,
    projectMap: normalizedProjectMap,
    platform,
    resolveRepoPath: (repoPath) => path.resolve(root, repoPath),
    resolvePathFrom: (basePath, ...segments) => path.resolve(path.dirname(basePath), ...segments),
    resolveChildPath: (basePath, ...segments) => path.resolve(basePath, ...segments),
    toRepoPath: (filePath) => relativeProjectPath(root, filePath),
    resolveGraphOutputPath(outputPath = normalizedProjectMap.project.graphOutput) {
      if (path.isAbsolute(outputPath)) {
        return outputPath
      }
      if (resolvedConfigPath && path.dirname(outputPath) === '.') {
        return path.resolve(path.dirname(resolvedConfigPath), outputPath)
      }
      return path.resolve(root, outputPath)
    }
  })
}

export function normalizeProjectMap(projectMap, configPath = null, { repoRoot: projectRoot = '.' } = {}) {
  const sourceRoots = projectMap.sourceRoots ?? {}
  const project = projectMap.project ?? {}
  return {
    ...projectMap,
    ...(configPath ? { configPath: relativeProjectPath(projectRoot, configPath) } : {}),
    project: {
      name: project.name ?? 'Code Map',
      graphOutput: project.graphOutput ?? '.code-map/graph.json',
      submapsDirectory: project.submapsDirectory ?? '.code-map/submaps',
      ...(project.runtimeLinks ? { runtimeLinks: project.runtimeLinks } : {})
    },
    sourceRoots: {
      frontend: sourceRoots.frontend,
      ...(sourceRoots.backend ? { backend: sourceRoots.backend } : {})
    },
    templates: {
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
      ...(projectMap.templates ?? {})
    },
    ignoredDirs: projectMap.ignoredDirs ?? defaultIgnoredDirs,
    imports: {
      aliases: projectMap.imports?.aliases ?? []
    },
    modules: {
      shared: 'shared',
      labels: {},
      utilityControllers: ['version', 'health', 'status', 'probe'],
      bootstrapStems: ['program', 'startup', 'dependencyinjection', 'servicecollectionextensions'],
      infrastructureFolders: defaultInfrastructureFolders,
      ...projectMap.modules
    },
    layers: projectMap.layers ?? [],
    types: {
      labels: projectMap.types?.labels ?? {},
      colors: projectMap.types?.colors ?? {}
    },
    frontend: {
      classifiers: defaultFrontendClassifiers,
      entryPoints: [],
      coverableTypes: ['route', 'page', 'main-component', 'component', 'subcomponent', 'hook', 'service', 'repository'],
      componentMainNamePattern: 'Main$|Main[A-Z]|View$|Container$|Content$',
      featureFolderPattern: '/features/{module}/',
      ...projectMap.frontend
    },
    rules: {
      enabled: [],
      options: {},
      ...projectMap.rules
    },
    backend: {
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
      ...projectMap.backend
    }
  }
}

export function validateProjectMap(
  projectMap,
  configPath = defaultProjectMapPath,
  { repoRoot: projectRoot = '.' } = {}
) {
  const errors = []
  if (!isRecord(projectMap)) {
    errors.push('Project map must be a JSON object.')
  } else {
    if (!Number.isInteger(projectMap.schemaVersion)) {
      errors.push('schemaVersion must be an integer.')
    } else if (projectMap.schemaVersion !== 1) {
      errors.push('Only project map schema version 1 is supported.')
    }
    if (projectMap.$schema !== undefined && typeof projectMap.$schema !== 'string') {
      errors.push('$schema must be a string.')
    }

    const project = projectMap.project
    if (!isRecord(project)) {
      errors.push('project must be an object.')
    }
    if (!project?.name) {
      errors.push('project.name is required.')
    } else if (!isNonEmptyString(project.name)) {
      errors.push('project.name must be a non-empty string.')
    }
    for (const key of ['graphOutput', 'runtimeLinks', 'submapsDirectory']) {
      validateOptionalNonEmptyString(errors, project?.[key], `project.${key}`)
    }

    const sourceRoots = projectMap.sourceRoots
    if (!isRecord(sourceRoots)) {
      errors.push('sourceRoots must be an object.')
    }
    if (!sourceRoots?.frontend) {
      errors.push('sourceRoots.frontend is required.')
    } else if (!isNonEmptyString(sourceRoots.frontend)) {
      errors.push('sourceRoots.frontend must be a non-empty string.')
    }
    validateOptionalNonEmptyString(errors, sourceRoots?.backend, 'sourceRoots.backend')
    if (isRecord(sourceRoots)) {
      validateKnownKeys(errors, sourceRoots, ['frontend', 'backend'], 'sourceRoots')
    }

    validateTemplates(errors, projectMap.templates)
    validateStringArray(errors, projectMap.ignoredDirs, 'ignoredDirs', { optional: true, allowEmptyItems: true })
    validateImports(errors, projectMap.imports)
    validateLayers(errors, projectMap.layers)
    validateRules(errors, projectMap.rules)
    for (const key of ['modules', 'types', 'frontend', 'backend']) {
      if (projectMap[key] !== undefined && !isRecord(projectMap[key])) {
        errors.push(`${key} must be an object.`)
      }
    }
  }
  if (errors.length > 0) {
    throw new Error(
      `Invalid project map ${relativeProjectPath(projectRoot, configPath)}:\n${errors.map((error) => `- ${error}`).join('\n')}`
    )
  }
}

function relativeProjectPath(projectRoot, filePath) {
  return path.relative(projectRoot, filePath).replaceAll(path.sep, '/')
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  for (const child of Object.values(value)) {
    deepFreeze(child)
  }
  return Object.freeze(value)
}

function validateTemplates(errors, templates) {
  if (templates === undefined) {
    return
  }
  if (!isRecord(templates)) {
    errors.push('templates must be an object.')
    return
  }
  validateStringArray(errors, templates.enabled, 'templates.enabled', { optional: true })
  validateStringArray(errors, templates.plugins, 'templates.plugins', { optional: true })
}

function validateImports(errors, imports) {
  if (imports === undefined) {
    return
  }
  if (!isRecord(imports)) {
    errors.push('imports must be an object.')
    return
  }
  if (imports.aliases !== undefined && !Array.isArray(imports.aliases)) {
    errors.push('imports.aliases must be an array.')
    return
  }
  for (const [index, alias] of (imports.aliases ?? []).entries()) {
    const location = `imports.aliases[${index}]`
    if (!isRecord(alias)) {
      errors.push(`${location} must be an object.`)
      continue
    }
    validateRequiredNonEmptyString(errors, alias.prefix, `${location}.prefix`)
    validateRequiredNonEmptyString(errors, alias.path, `${location}.path`)
    validateKnownKeys(errors, alias, ['prefix', 'path'], location)
  }
}

function validateLayers(errors, layers) {
  if (layers === undefined) {
    return
  }
  if (!Array.isArray(layers) || layers.length === 0) {
    errors.push('layers must contain at least one layer when provided.')
    return
  }
  for (const [index, layer] of layers.entries()) {
    const location = `layers[${index}]`
    if (!isRecord(layer)) {
      errors.push(`${location} must be an object.`)
      continue
    }
    validateRequiredNonEmptyString(errors, layer.id, `${location}.id`)
    validateRequiredNonEmptyString(errors, layer.label, `${location}.label`)
  }
}

function validateRules(errors, rules) {
  if (rules === undefined) {
    return
  }
  if (!isRecord(rules)) {
    errors.push('rules must be an object.')
    return
  }
  validateStringArray(errors, rules.enabled, 'rules.enabled', { optional: true, allowEmptyItems: true })
  if (rules.options !== undefined && !isRecord(rules.options)) {
    errors.push('rules.options must be an object.')
  }
  if (rules.suppressions !== undefined && !Array.isArray(rules.suppressions)) {
    errors.push('rules.suppressions must be an array.')
    return
  }
  for (const [index, suppression] of (rules.suppressions ?? []).entries()) {
    const location = `rules.suppressions[${index}]`
    if (!isRecord(suppression)) {
      errors.push(`${location} must be an object.`)
      continue
    }
    validateRequiredNonEmptyString(errors, suppression.reason, `${location}.reason`)
    for (const key of ['ruleId', 'pathPattern', 'expiresOn']) {
      if (suppression[key] !== undefined && typeof suppression[key] !== 'string') {
        errors.push(`${location}.${key} must be a string.`)
      }
    }
  }
}

function validateStringArray(errors, value, location, { optional = false, allowEmptyItems = false } = {}) {
  if (optional && value === undefined) {
    return
  }
  if (!Array.isArray(value)) {
    errors.push(`${location} must be an array.`)
    return
  }
  if (value.some((item) => typeof item !== 'string' || (!allowEmptyItems && !item.trim()))) {
    errors.push(`${location} must contain ${allowEmptyItems ? 'only strings' : 'only non-empty strings'}.`)
  }
}

function validateRequiredNonEmptyString(errors, value, location) {
  if (!isNonEmptyString(value)) {
    errors.push(`${location} must be a non-empty string.`)
  }
}

function validateOptionalNonEmptyString(errors, value, location) {
  if (value !== undefined) {
    validateRequiredNonEmptyString(errors, value, location)
  }
}

function validateKnownKeys(errors, value, allowed, location) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key))
  if (unknown.length > 0) {
    errors.push(`${location} contains unknown properties: ${unknown.sort().join(', ')}.`)
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
