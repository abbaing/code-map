export const allowedDependencyRoles = Object.freeze({
  core: Object.freeze(['core']),
  application: Object.freeze(['core', 'application']),
  extension: Object.freeze(['core', 'extension']),
  adapter: Object.freeze(['core', 'application', 'extension', 'adapter']),
  'composition-root': Object.freeze(['core', 'application', 'extension', 'adapter', 'composition-root'])
})

export const legacyDependencyEdges = Object.freeze([
  'index.mjs -> submap/index.mjs',
  'scan.mjs -> templates/registry.mjs',
  'scan.mjs -> templates/contracts.mjs',
  'server-app-node.mjs -> submap/index.mjs',
  'cli-commands.mjs -> templates/registry.mjs',
  'cli-commands.mjs -> server.mjs'
])

export function dependencyEdge(source, target) {
  return `${source} -> ${target}`
}
