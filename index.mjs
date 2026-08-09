export { Graph } from './graph.mjs'
import { createProjectContext as createContext, loadProjectContext as loadContext } from './config.mjs'
import { writeGraph as writeGraphWithContext } from './scan.mjs'
import { createNodePlatform, nodePlatform } from './platform/node.mjs'

export { createNodePlatform, nodePlatform }

export function createProjectContext(projectMap, options = {}) {
  return createContext(projectMap, { ...options, platform: options.platform ?? nodePlatform })
}

export function loadProjectContext(source, options = {}) {
  return loadContext(source, { ...options, platform: options.platform ?? nodePlatform })
}

export function writeGraph(outputPath, projectContext = loadProjectContext()) {
  return writeGraphWithContext(outputPath, projectContext)
}

export * from './submap/index.mjs'
