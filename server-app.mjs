import fs from 'node:fs'
import path from 'node:path'
import { writeGraph } from './scan.mjs'
import { getProjectMap, getProjectMapPath, loadProjectMap, resolveGraphOutputPath, validateProjectMap } from './config.mjs'
import { createSubmap, defaultSubmapFilename, writeSubmap } from './submap/index.mjs'

export class ApplicationInputError extends Error {}

export function createServerApplication({ repoRoot = process.cwd() } = {}) {
  const projectRoot = canonicalPath(repoRoot)

  return {
    graphPath: () => projectPath(resolveGraphOutputPath(), 'project.graphOutput'),
    projectMap: () => getProjectMap(),
    scan,
    saveProjectMap,
    createTraceSubmap
  }

  function scan() {
    assertProjectMapPaths(getProjectMap(), getProjectMapPath())
    return writeGraph(projectPath(resolveGraphOutputPath(), 'project.graphOutput'))
  }

  function saveProjectMap(input) {
    const projectMapPath = getProjectMapPath()
    if (!projectMapPath) {
      throw new ApplicationInputError('Cannot save an auto-detected project map. Export the config or restart code-map with --config <path>.')
    }
    projectPath(projectMapPath, 'Project map')

    const document = structuredClone(input)
    delete document.configPath
    try {
      validateProjectMap(document, projectMapPath)
    } catch (error) {
      throw new ApplicationInputError(error.message, { cause: error })
    }
    assertProjectMapPaths(document, projectMapPath)

    fs.writeFileSync(projectMapPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
    loadProjectMap(projectMapPath)
    const graph = scan()
    return { projectMap: getProjectMap(), stats: graph.stats }
  }

  function createTraceSubmap(input) {
    if (!Array.isArray(input.nodeIds) || input.nodeIds.length === 0) {
      throw new ApplicationInputError('A non-empty trace selection is required.')
    }
    assertProjectMapPaths(getProjectMap(), getProjectMapPath())
    const graph = JSON.parse(fs.readFileSync(projectPath(resolveGraphOutputPath(), 'project.graphOutput'), 'utf8'))
    const request = {
      id: input.id,
      selectors: { nodeIds: [...new Set(input.nodeIds)] },
      traversal: { direction: 'both', maxDepth: 0 },
      metadata: {
        kind: 'execution-trace',
        selectedNodeId: input.selectedNodeId,
        complete: Boolean(input.complete),
        traceEdgeIds: Array.isArray(input.edgeIds) ? [...new Set(input.edgeIds)] : []
      }
    }
    const submap = createSubmap(graph, request)
    const directory = projectPath(
      path.resolve(repoRoot, getProjectMap().project.submapsDirectory ?? '.code-map/submaps'),
      'project.submapsDirectory'
    )
    const output = path.join(directory, defaultSubmapFilename(submap))
    writeSubmap(output, submap)
    return {
      file: path.relative(repoRoot, output),
      uid: submap.uid,
      statistics: submap.statistics
    }
  }

  function assertProjectMapPaths(projectMap, configPath) {
    const assertRepoRelative = (value, label) => {
      if (value === undefined) return
      assertPathValue(value, label)
      projectPath(path.resolve(repoRoot, value), label)
    }

    assertRepoRelative(projectMap.sourceRoots?.frontend, 'sourceRoots.frontend')
    assertRepoRelative(projectMap.sourceRoots?.backend, 'sourceRoots.backend')
    assertRepoRelative(projectMap.project?.runtimeLinks, 'project.runtimeLinks')
    assertRepoRelative(projectMap.project?.submapsDirectory ?? '.code-map/submaps', 'project.submapsDirectory')

    const graphOutput = projectMap.project?.graphOutput ?? '.code-map/graph.json'
    assertPathValue(graphOutput, 'project.graphOutput')
    const graphPath = !path.isAbsolute(graphOutput) && path.dirname(graphOutput) === '.' && configPath
      ? path.resolve(path.dirname(configPath), graphOutput)
      : path.resolve(repoRoot, graphOutput)
    projectPath(graphPath, 'project.graphOutput')

    for (const [index, alias] of (projectMap.imports?.aliases ?? []).entries()) {
      assertRepoRelative(alias?.path, `imports.aliases[${index}].path`)
    }

    const plugins = projectMap.templates?.plugins ?? []
    if (!Array.isArray(plugins)) {
      throw new ApplicationInputError('templates.plugins must be an array of path strings.')
    }
    const configDirectory = path.dirname(configPath ?? path.join(repoRoot, 'project-map.json'))
    for (const [index, plugin] of plugins.entries()) {
      assertPathValue(plugin, `templates.plugins[${index}]`)
      projectPath(path.isAbsolute(plugin) ? plugin : path.resolve(configDirectory, plugin), `templates.plugins[${index}]`)
    }
  }

  function projectPath(candidate, label) {
    const resolved = canonicalPath(candidate)
    const relative = path.relative(projectRoot, resolved)
    const escapesRoot = relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
    if (escapesRoot) throw new ApplicationInputError(`${label} must resolve within the project root.`)
    return path.resolve(candidate)
  }
}

function assertPathValue(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApplicationInputError(`${label} must be a non-empty path string.`)
  }
}

function canonicalPath(candidate) {
  let existing = path.resolve(candidate)
  const missing = []
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing)
    if (parent === existing) break
    missing.unshift(path.basename(existing))
    existing = parent
  }
  const real = fs.realpathSync(existing)
  return path.resolve(real, ...missing)
}
