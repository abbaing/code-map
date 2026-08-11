import path from 'node:path'
import { assertPlatform } from '#platform/contracts.mjs'
import { normalizeProjectMap } from '#core/config-normalization.mjs'
import { validateProjectMap } from '#core/config-validation.mjs'

export function getConfigPathFromArgs(argv, { cwd, configPath, fileSystem } = {}) {
  if (!Array.isArray(argv) || !cwd) {
    throw new TypeError('Config discovery requires argument and working-directory inputs.')
  }
  const argumentIndex = argv.indexOf('--config')
  if (argumentIndex >= 0 && argv[argumentIndex + 1]) {
    return path.resolve(cwd, argv[argumentIndex + 1])
  }
  if (configPath) {
    return path.resolve(cwd, configPath)
  }
  if (!fileSystem) {
    throw new TypeError('Config discovery requires a filesystem capability.')
  }
  return findLocalProjectMapPath(cwd, fileSystem)
}

export function loadProjectContext(source, options = {}) {
  const { platform: suppliedPlatform, repoRoot, argv, configPath, defaultConfigPath } = options
  const platform = assertPlatform(suppliedPlatform)
  const projectRoot = repoRoot ?? platform.environment.cwd()
  const arguments_ = argv ?? platform.environment.args()
  const configSource = source ?? discoverConfig(arguments_, projectRoot, configPath, platform)
  if (configSource && typeof configSource === 'object') {
    return createProjectContext(configSource, { repoRoot: projectRoot, platform, defaultConfigPath })
  }
  if (!configSource) {
    throw new Error('No project-map.json found. Run code-map --init or pass --config <path>.')
  }
  return loadProjectMapFile(configSource, projectRoot, platform, defaultConfigPath)
}

export function createProjectContext(projectMap, options = {}) {
  const { repoRoot = '.', configPath = null, platform: suppliedPlatform, defaultConfigPath } = options
  const platform = assertPlatform(suppliedPlatform)
  const root = path.resolve(repoRoot)
  const resolvedConfigPath = configPath ? path.resolve(root, configPath) : null
  const pathForValidation = resolvedConfigPath ?? defaultConfigPath ?? path.resolve(root, 'project-map.json')
  validateProjectMap(projectMap, pathForValidation, { repoRoot: root, toRepoPath })
  const normalized = normalizeProjectMap(projectMap, resolvedConfigPath, { repoRoot: root, toRepoPath })
  const frozenMap = deepFreeze(structuredClone(normalized))
  return createContextContract(root, resolvedConfigPath, frozenMap, platform)
}

function discoverConfig(argv, root, configPath, platform) {
  return getConfigPathFromArgs(argv, {
    cwd: root,
    configPath: configPath ?? platform.environment.variable('CODE_MAP_CONFIG'),
    fileSystem: platform.fileSystem
  })
}

function loadProjectMapFile(source, root, platform, defaultConfigPath) {
  const resolvedPath = path.resolve(root, source)
  let projectMap
  try {
    projectMap = JSON.parse(platform.fileSystem.readText(resolvedPath))
  } catch (error) {
    throw new Error(`Failed to read project map at ${toRepoPath(root, resolvedPath)}: ${error.message}`)
  }
  return createProjectContext(projectMap, {
    repoRoot: root,
    configPath: resolvedPath,
    platform,
    defaultConfigPath
  })
}

function createContextContract(root, configPath, projectMap, platform) {
  return Object.freeze({
    repoRoot: root,
    configPath,
    projectMap,
    platform,
    resolveRepoPath: (repoPath) => path.resolve(root, repoPath),
    resolvePathFrom: (basePath, ...segments) => path.resolve(path.dirname(basePath), ...segments),
    resolveChildPath: (basePath, ...segments) => path.resolve(basePath, ...segments),
    toRepoPath: (filePath) => toRepoPath(root, filePath),
    resolveGraphOutputPath: (outputPath = projectMap.project.graphOutput) =>
      resolveGraphOutput(root, configPath, outputPath)
  })
}

function resolveGraphOutput(root, configPath, outputPath) {
  if (path.isAbsolute(outputPath)) {
    return outputPath
  }
  if (configPath && path.dirname(outputPath) === '.') {
    return path.resolve(path.dirname(configPath), outputPath)
  }
  return path.resolve(root, outputPath)
}

function findLocalProjectMapPath(cwd, fileSystem) {
  for (const directory of [cwd, path.join(cwd, '.code-map')]) {
    const match = findProjectMap(directory, fileSystem)
    if (match) {
      return path.join(directory, match)
    }
  }
  return null
}

function findProjectMap(directory, fileSystem) {
  try {
    const files = fileSystem.readDirectory(directory)
    return files.find((file) => file === 'project-map.json') ?? files.find((file) => file.endsWith('.project-map.json'))
  } catch {
    return null
  }
}

function toRepoPath(root, filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, '/')
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
