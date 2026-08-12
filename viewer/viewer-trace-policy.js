export const TRACE_EDGE_TYPES = new Set([
  'imports',
  'lazy-imports',
  'calls-api',
  'sends',
  'handled-by',
  'depends-on',
  'uses-entity',
  'queries-table',
  'maps-to-table'
])

export const SYSTEM_MODULE_EDGE_TYPES = new Set([
  'imports',
  'lazy-imports',
  'calls-api',
  'sends',
  'handled-by',
  'depends-on'
])

export const TRACE_STAGE_DEFINITIONS = [
  ['route-root', 'Route component'],
  ['route', 'Feature route'],
  ['page', 'Views'],
  ['main', 'Main component'],
  ['component', 'Components'],
  ['subcomponent', 'Subcomponents'],
  ['support', 'Hooks / support'],
  ['front-service', 'Frontend services'],
  ['front-repository', 'API clients'],
  ['endpoint', 'Backend entry'],
  ['request', 'Command / Query'],
  ['handler', 'Handlers'],
  ['back-service', 'Backend services'],
  ['back-repository', 'Repositories'],
  ['entity', 'EF entities'],
  ['table', 'Database tables']
].map(([id, label]) => ({ id, label }))

export function traceEdgeAllowed(edge, nodeById, graphEdges) {
  if (!TRACE_EDGE_TYPES.has(edge.type)) {
    return false
  }
  const from = nodeById.get(edge.from)
  const to = nodeById.get(edge.to)
  if (!from || !to || isDataContextCatalogEdge(edge, nodeById)) {
    return false
  }
  if (edge.type === 'handled-by' && from.type === 'endpoint' && to.type === 'controller') {
    return false
  }
  if (from.type === 'controller' || to.type === 'controller') {
    return false
  }
  if (edge.type === 'queries-table' && ['handler', 'service'].includes(from.type)) {
    return !graphEdges.some((candidate) => candidate.from === from.id && candidate.type === 'depends-on')
  }
  return true
}

export function isDataContextCatalogEdge(edge, nodeById) {
  if (edge.type === 'dbset') {
    return true
  }
  const from = nodeById.get(edge.from)
  const to = nodeById.get(edge.to)
  return Boolean(
    from?.type === 'data-context' &&
    ((edge.type === 'uses-entity' && to?.type === 'entity') || (edge.type === 'queries-table' && to?.type === 'table'))
  )
}

export function isFrontendOrigin(node, entryPoints) {
  if (node?.type !== 'route') {
    return false
  }
  return entryPoints.length === 0 || entryPoints.includes(node.path)
}

export function isPersistenceTarget(node) {
  return node?.type === 'table'
}

export function traceStage(node, entryPoints) {
  const directStages = {
    page: 'page',
    'main-component': 'main',
    component: 'component',
    subcomponent: 'subcomponent',
    endpoint: 'endpoint',
    handler: 'handler',
    entity: 'entity',
    table: 'table',
    'data-context': 'back-repository'
  }
  const specialized = specializedStage(node, entryPoints)
  return specialized ?? directStages[node.type] ?? fallbackStage(node)
}

export function nodeHeight(node, view = 'graph') {
  if (view === 'domain' && node.type === 'entity') {
    const length = domainPropertyCount(node)
    const propertyCount = Math.min(length, 10)
    const hasMore = length > propertyCount
    return Math.max(104, 52 + propertyCount * 16 + (hasMore ? 20 : 10))
  }
  return hasQuality(node) ? 66 : 52
}

function specializedStage(node, entryPoints) {
  if (node.type === 'route') {
    return isFrontendOrigin(node, entryPoints) ? 'route-root' : 'route'
  }
  if (node.type === 'hook' || node.layer === 'auxiliary') {
    return 'support'
  }
  if (['command', 'query'].includes(node.type)) {
    return 'request'
  }
  if (node.type === 'service') {
    return node.layer === 'backend-service' ? 'back-service' : 'front-service'
  }
  if (node.type === 'repository') {
    return node.layer === 'backend-repository' ? 'back-repository' : 'front-repository'
  }
  return null
}

function fallbackStage(node) {
  return node.path?.startsWith('back/') ? 'back-service' : 'support'
}

function domainPropertyCount(node) {
  return node.meta?.domain?.properties?.length ?? 0
}

function hasQuality(node) {
  return Boolean(node.meta?.quality)
}
