import fs from 'node:fs'
import path from 'node:path'
import { writeGraph } from './scan.mjs'
import { getProjectMap, getProjectMapPath, loadProjectMap, resolveGraphOutputPath, validateProjectMap } from './config.mjs'
import { createSubmap, defaultSubmapFilename, writeSubmap } from './submap/index.mjs'

export class ApplicationInputError extends Error {}

export function createServerApplication({ repoRoot = process.cwd() } = {}) {
  return {
    graphPath: () => resolveGraphOutputPath(),
    projectMap: () => getProjectMap(),
    scan,
    saveProjectMap,
    createTraceSubmap
  }

  function scan() {
    return writeGraph(resolveGraphOutputPath())
  }

  function saveProjectMap(input) {
    const projectMapPath = getProjectMapPath()
    if (!projectMapPath) {
      throw new ApplicationInputError('Cannot save an auto-detected project map. Export the config or restart code-map with --config <path>.')
    }

    const document = structuredClone(input)
    delete document.configPath
    try {
      validateProjectMap(document, projectMapPath)
    } catch (error) {
      throw new ApplicationInputError(error.message, { cause: error })
    }

    fs.writeFileSync(projectMapPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
    loadProjectMap(projectMapPath)
    const graph = scan()
    return { projectMap: getProjectMap(), stats: graph.stats }
  }

  function createTraceSubmap(input) {
    if (!Array.isArray(input.nodeIds) || input.nodeIds.length === 0) {
      throw new ApplicationInputError('A non-empty trace selection is required.')
    }
    const graph = JSON.parse(fs.readFileSync(resolveGraphOutputPath(), 'utf8'))
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
    const directory = path.resolve(repoRoot, getProjectMap().project.submapsDirectory ?? '.code-map/submaps')
    const output = path.join(directory, defaultSubmapFilename(submap))
    writeSubmap(output, submap)
    return {
      file: path.relative(repoRoot, output),
      uid: submap.uid,
      statistics: submap.statistics
    }
  }
}
