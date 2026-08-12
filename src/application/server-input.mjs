import path from 'node:path'
import { ApplicationInputError } from '#app/server-contracts.mjs'

export function createProjectPathPolicy(repoRoot, fileSystem) {
  const projectRoot = canonicalPath(repoRoot, fileSystem)

  function projectPath(candidate, label) {
    const resolved = canonicalPath(candidate, fileSystem)
    const relative = path.relative(projectRoot, resolved)
    const escapes = relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
    if (escapes) {
      throw new ApplicationInputError(`${label} must resolve within the project root.`)
    }
    return path.resolve(candidate)
  }

  function assertProjectMapPaths(projectMap, configPath) {
    const assertRelative = (value, label) => {
      if (value === undefined) {
        return
      }
      assertPathValue(value, label)
      projectPath(path.resolve(repoRoot, value), label)
    }
    assertRelative(projectMap.sourceRoots?.frontend, 'sourceRoots.frontend')
    assertRelative(projectMap.sourceRoots?.backend, 'sourceRoots.backend')
    assertRelative(projectMap.project?.runtimeLinks, 'project.runtimeLinks')
    assertRelative(projectMap.project?.submapsDirectory ?? '.code-map/submaps', 'project.submapsDirectory')
    assertGraphOutput(projectMap, configPath, repoRoot, projectPath)
    for (const [index, alias] of (projectMap.imports?.aliases ?? []).entries()) {
      assertRelative(alias?.path, `imports.aliases[${index}].path`)
    }
    assertPluginPaths(projectMap, configPath, repoRoot, projectPath)
  }

  return Object.freeze({ projectPath, assertProjectMapPaths })
}

export function assertPluginConfigurationUnchanged(candidate, current) {
  const candidatePlugins = candidate.templates?.plugins ?? []
  const currentPlugins = current.templates?.plugins ?? []
  if (
    candidatePlugins.length === currentPlugins.length &&
    candidatePlugins.every((plugin, index) => plugin === currentPlugins[index])
  ) {
    return
  }
  throw new ApplicationInputError(
    'Template plugins cannot be changed from the viewer. Edit the project-map file and restart with --allow-plugins after reviewing the modules.'
  )
}

export function validateTraceInput(input) {
  if (!isRecord(input)) {
    throw new ApplicationInputError('Trace request must be a JSON object.')
  }
  const allowed = ['id', 'nodeIds', 'edgeIds', 'selectedNodeId', 'complete']
  const unknown = Object.keys(input).filter((key) => !allowed.includes(key))
  if (unknown.length > 0) {
    throw new ApplicationInputError(`Unknown trace request properties: ${unknown.sort().join(', ')}.`)
  }
  if (!Array.isArray(input.nodeIds) || input.nodeIds.length === 0) {
    throw new ApplicationInputError('A non-empty trace selection is required.')
  }
  assertNonEmptyStringArray(input.nodeIds, 'nodeIds')
  if (input.edgeIds !== undefined) {
    assertNonEmptyStringArray(input.edgeIds, 'edgeIds')
  }
  assertTraceId(input.id)
  if (
    input.selectedNodeId !== undefined &&
    (typeof input.selectedNodeId !== 'string' || !input.selectedNodeId.trim())
  ) {
    throw new ApplicationInputError('selectedNodeId must be a non-empty string.')
  }
  if (input.complete !== undefined && typeof input.complete !== 'boolean') {
    throw new ApplicationInputError('complete must be a boolean.')
  }
}

function assertTraceId(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(id)) {
    throw new ApplicationInputError('Trace id must use letters, numbers, dots, underscores, or hyphens.')
  }
}

function assertGraphOutput(projectMap, configPath, repoRoot, projectPath) {
  const output = projectMap.project?.graphOutput ?? '.code-map/graph.json'
  assertPathValue(output, 'project.graphOutput')
  const resolved =
    !path.isAbsolute(output) && path.dirname(output) === '.' && configPath
      ? path.resolve(path.dirname(configPath), output)
      : path.resolve(repoRoot, output)
  projectPath(resolved, 'project.graphOutput')
}

function assertPluginPaths(projectMap, configPath, repoRoot, projectPath) {
  const plugins = projectMap.templates?.plugins ?? []
  if (!Array.isArray(plugins)) {
    throw new ApplicationInputError('templates.plugins must be an array of path strings.')
  }
  const directory = path.dirname(configPath ?? path.join(repoRoot, 'project-map.json'))
  for (const [index, plugin] of plugins.entries()) {
    assertPathValue(plugin, `templates.plugins[${index}]`)
    projectPath(path.isAbsolute(plugin) ? plugin : path.resolve(directory, plugin), `templates.plugins[${index}]`)
  }
}

function assertNonEmptyStringArray(value, location) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new ApplicationInputError(`${location} must be an array of non-empty strings.`)
  }
}

function assertPathValue(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApplicationInputError(`${label} must be a non-empty path string.`)
  }
}

function canonicalPath(candidate, fileSystem) {
  let existing = path.resolve(candidate)
  const missing = []
  while (!fileSystem.exists(existing)) {
    const parent = path.dirname(existing)
    if (parent === existing) {
      break
    }
    missing.unshift(path.basename(existing))
    existing = parent
  }
  return path.resolve(fileSystem.realPath(existing), ...missing)
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
