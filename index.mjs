export { Graph } from '#core/graph.mjs'
import { createProjectContext as createContext, loadProjectContext as loadContext } from '#core/config.mjs'
import { writeGraph as writeGraphWithContext } from '#app/scan.mjs'
import { nodeTextWriter } from '#node/json-io.mjs'
import { createNodePlatform, nodePlatform } from '#platform/node.mjs'
import { buildTemplateRegistry } from '#templates/registry.mjs'

export { createNodePlatform, nodePlatform }
export { createScanPipeline, defineScanPhase } from '#core/scan-pipeline.mjs'
export { createDefaultScanPipeline } from '#app/scan.mjs'

export function createProjectContext(projectMap, options = {}) {
  return createContext(projectMap, { ...options, platform: options.platform ?? nodePlatform })
}

export function loadProjectContext(source, options = {}) {
  return loadContext(source, { ...options, platform: options.platform ?? nodePlatform })
}

export function writeGraph(outputPath, projectContext = loadProjectContext(), options = {}) {
  return writeGraphWithContext(outputPath, projectContext, {
    registry: buildTemplateRegistry(projectContext.projectMap),
    writer: nodeTextWriter,
    ...options
  })
}

export * from '#submap/index.mjs'
