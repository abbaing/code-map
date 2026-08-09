export { Graph } from './graph.mjs'
import { createProjectContext as createContext, loadProjectContext as loadContext } from './config.mjs'
import { writeGraph as writeGraphWithContext } from './scan.mjs'
import { nodeTextWriter } from './json-io.mjs'
import { createNodePlatform, nodePlatform } from './platform/node.mjs'
import { buildTemplateRegistry } from './templates/registry.mjs'

export { createNodePlatform, nodePlatform }
export { createScanPipeline, defineScanPhase } from './scan-pipeline.mjs'
export { createDefaultScanPipeline } from './scan.mjs'

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

export * from './submap/index.mjs'
