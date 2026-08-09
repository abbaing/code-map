export const allowedDependencyRoles = Object.freeze({
  core: Object.freeze(['core']),
  application: Object.freeze(['core', 'application']),
  extension: Object.freeze(['core', 'extension']),
  adapter: Object.freeze(['core', 'application', 'extension', 'adapter']),
  'composition-root': Object.freeze(['core', 'application', 'extension', 'adapter', 'composition-root'])
})

export const legacyDependencyEdges = Object.freeze([])

export function dependencyEdge(source, target) {
  return `${source} -> ${target}`
}
