import { traceEdgeAllowed } from '#viewer/viewer-trace-policy.js'
import { adjacencyFor, reachableFromMany, reverseReachableFrom } from '#viewer/viewer-trace-reachability.js'

export function buildModuleTraceContext(graph, module) {
  if (!module || !graph) {
    return null
  }
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const moduleNodeIds = new Set(
    graph.nodes.filter((node) => node.module === module && node.type !== 'controller').map((node) => node.id)
  )
  const edges = graph.edges.filter((edge) => traceEdgeAllowed(edge, nodeById, graph.edges))
  const outgoing = adjacencyFor(edges, 'outgoing')
  const incoming = adjacencyFor(edges, 'incoming')
  const nodeIds = new Set(moduleNodeIds)
  addFrontendAncestors(moduleNodeIds, incoming, nodeById, nodeIds)
  const persistence = addPersistencePaths(moduleNodeIds, outgoing, incoming, nodeById, nodeIds)
  const edgeIds = new Set(edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)).map((edge) => edge.id))
  return {
    moduleOverview: true,
    nodeIds,
    edgeIds,
    primaryNodeIds: [],
    allNodeIds: nodeIds,
    allEdgeIds: edgeIds,
    complete: persistence.size > 0,
    showAll: true
  }
}

export function moduleTraceNodeIds(graph, module) {
  return buildModuleTraceContext(graph, module)?.nodeIds ?? new Set()
}

function addFrontendAncestors(moduleIds, incoming, nodeById, nodeIds) {
  const seeds = [...moduleIds].filter((id) => nodeById.get(id)?.path?.startsWith('front/'))
  for (const id of reachableFromMany(seeds, incoming, 20)) {
    if (nodeById.get(id)?.path?.startsWith('front/')) {
      nodeIds.add(id)
    }
  }
}

function addPersistencePaths(moduleIds, outgoing, incoming, nodeById, nodeIds) {
  const forward = reachableFromMany(moduleIds, outgoing, 24)
  let persistence = new Set([...forward].filter((id) => nodeById.get(id)?.type === 'table'))
  if (persistence.size === 0) {
    persistence = new Set([...forward].filter((id) => nodeById.get(id)?.type === 'entity'))
  }
  const canReach = reverseReachableFrom(persistence, incoming)
  for (const id of forward) {
    if (canReach.has(id)) {
      nodeIds.add(id)
    }
  }
  return persistence
}
