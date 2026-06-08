import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const repoRoot = process.cwd()
export const defaultProjectMapPath = path.join(__dirname, 'presets/starter.project-map.json')

function findLocalProjectMapPath(cwd = process.cwd()) {
  try {
    const files = fs.readdirSync(cwd)
    const exact = files.find(f => f === 'project-map.json')
    if (exact) return path.join(cwd, exact)
    const named = files.find(f => f.endsWith('.project-map.json'))
    if (named) return path.join(cwd, named)
  } catch { /* no local config */ }
  return null
}

let activeProjectMap = null
let activeProjectMapPath = null

export function resolveRepoPath(repoPath) {
  return path.resolve(repoRoot, repoPath)
}

export function toRepoPath(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, '/')
}

export function getConfigPathFromArgs(argv = process.argv) {
  const configArgIndex = argv.indexOf('--config')
  if (configArgIndex >= 0 && argv[configArgIndex + 1]) {
    return path.resolve(argv[configArgIndex + 1])
  }
  if (process.env.CODE_MAP_CONFIG) {
    return path.resolve(process.env.CODE_MAP_CONFIG)
  }
  return findLocalProjectMapPath()
}

export function loadProjectMap(configPath = getConfigPathFromArgs()) {
  if (configPath && typeof configPath === 'object') {
    // Accept a pre-built config object (e.g. from detect.mjs)
    validateProjectMap(configPath)
    activeProjectMap = normalizeProjectMap(configPath)
    activeProjectMapPath = null
    return activeProjectMap
  }
  if (!configPath) {
    throw new Error('No project-map.json found. Run code-map --init or pass --config <path>.')
  }
  const resolvedPath = path.resolve(configPath)
  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'))
  } catch (err) {
    throw new Error(`Failed to read project map at ${toRepoPath(resolvedPath)}: ${err.message}`)
  }
  validateProjectMap(parsed, resolvedPath)
  activeProjectMap = normalizeProjectMap(parsed, resolvedPath)
  activeProjectMapPath = resolvedPath
  return activeProjectMap
}

export function getProjectMap() {
  return activeProjectMap ?? loadProjectMap()
}

export function getProjectMapPath() {
  return activeProjectMapPath
}

export function normalizeProjectMap(projectMap, configPath = null) {
  const sourceRoots = projectMap.sourceRoots ?? {}
  const project = projectMap.project ?? {}
  return {
    ...projectMap,
    ...(configPath ? { configPath: toRepoPath(configPath) } : {}),
    project: {
      name: project.name ?? 'Code Map',
      graphOutput: project.graphOutput ?? 'graph.json',
      runtimeLinks: project.runtimeLinks ?? 'runtime-links.json'
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
    ignoredDirs: projectMap.ignoredDirs ?? ['node_modules', 'dist', 'build', 'coverage', 'bin', 'obj', '.git'],
    imports: {
      aliases: projectMap.imports?.aliases ?? []
    },
    modules: {
      shared: 'shared',
      labels: {},
      utilityControllers: [],
      bootstrapStems: [],
      infrastructureFolders: [],
      ...projectMap.modules
    },
    layers: projectMap.layers ?? [],
    types: {
      labels: projectMap.types?.labels ?? {},
      colors: projectMap.types?.colors ?? {}
    },
    frontend: {
      classifiers: [],
      entryPoints: [],
      coverableTypes: [],
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
      classifiers: [],
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

export function validateProjectMap(projectMap, configPath = defaultProjectMapPath) {
  const errors = []
  if (!projectMap || typeof projectMap !== 'object') errors.push('Project map must be a JSON object.')
  if (!Number.isInteger(projectMap?.schemaVersion)) errors.push('schemaVersion must be an integer.')
  if (!projectMap?.project?.name) errors.push('project.name is required.')
  if (!projectMap?.sourceRoots?.frontend) errors.push('sourceRoots.frontend is required.')
  if (!Array.isArray(projectMap?.layers) || projectMap.layers.length === 0) errors.push('layers must contain at least one layer.')
  if (!Array.isArray(projectMap?.imports?.aliases)) errors.push('imports.aliases must be an array.')
  if (errors.length > 0) {
    throw new Error(`Invalid project map ${toRepoPath(configPath)}:\n${errors.map(error => `- ${error}`).join('\n')}`)
  }
}
