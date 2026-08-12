import { isFrontendOrigin, isPersistenceTarget, traceEdgeAllowed } from '#viewer/viewer-trace-policy.js'
import { adjacencyFor, allTraceNodeIds, mergePaths } from '#viewer/viewer-trace-reachability.js'
import { shortestTracePath, traceSearchTokens } from '#viewer/viewer-trace-search.js'

export function buildTraceContext(graph, selectedId, showAll = false) {
  if (!selectedId || !graph) {
    return null
  }
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const selected = nodeById.get(selectedId)
  if (!selected) {
    return null
  }
  const entryPoints = graph.projectMap?.frontend?.entryPoints ?? []
  const edges = graph.edges.filter((edge) => traceEdgeAllowed(edge, nodeById, graph.edges))
  const outgoing = adjacencyFor(edges, 'outgoing')
  const incoming = adjacencyFor(edges, 'incoming')
  const leftPath = shortestTracePath(selectedId, incoming, nodeById, (node) => isFrontendOrigin(node, entryPoints))
  const tokens = contextTokens(selected, leftPath.nodes, nodeById, entryPoints)
  const continuation = resolvePersistencePath({
    selected,
    selectedId,
    leftPath,
    outgoing,
    nodeById,
    entryPoints,
    tokens
  })
  return assembleTrace({
    selectedId,
    showAll,
    edges,
    outgoing,
    incoming,
    nodeById,
    entryPoints,
    leftPath,
    ...continuation
  })
}

function resolvePersistencePath(context) {
  let rightPath = persistencePath(context.selectedId, context.outgoing, context.nodeById, context.tokens)
  let continuedFromAncestor = null
  if (!rightPath.found && ['component', 'subcomponent', 'hook'].includes(context.selected.type)) {
    const continuation = ancestorContinuation(context)
    rightPath = continuation.rightPath
    continuedFromAncestor = continuation.continuedFromAncestor
  }
  return { rightPath, continuedFromAncestor }
}

function ancestorContinuation(context) {
  for (const ancestorId of context.leftPath.nodes.slice(1)) {
    const ancestor = context.nodeById.get(ancestorId)
    if (!isContinuationContainer(context.selected, ancestor, context.entryPoints)) {
      continue
    }
    const candidate = persistencePath(ancestorId, context.outgoing, context.nodeById, context.tokens)
    if (candidate.found) {
      return { rightPath: candidate, continuedFromAncestor: ancestorId }
    }
  }
  return { rightPath: { nodes: [context.selectedId], edges: [], found: false }, continuedFromAncestor: null }
}

function persistencePath(startId, outgoing, nodeById, tokens) {
  const tablePath = shortestTracePath(startId, outgoing, nodeById, isPersistenceTarget, tokens)
  return tablePath.found
    ? tablePath
    : shortestTracePath(startId, outgoing, nodeById, (node) => node?.type === 'entity', tokens)
}

function assembleTrace(context) {
  const primaryNodeIds = mergePaths(context.leftPath.nodes.slice().reverse(), context.rightPath.nodes.slice(1))
  const primaryEdgeIds = new Set([...context.leftPath.edges, ...context.rightPath.edges])
  const root = context.continuedFromAncestor ?? context.selectedId
  const allNodeIds = allTraceNodeIds(root, context.outgoing, context.incoming, context.nodeById, context.entryPoints)
  allNodeIds.add(context.selectedId)
  for (const id of context.leftPath.nodes) {
    allNodeIds.add(id)
  }
  const allEdgeIds = new Set(
    context.edges.filter((edge) => allNodeIds.has(edge.from) && allNodeIds.has(edge.to)).map((edge) => edge.id)
  )
  return traceResult(context, primaryNodeIds, primaryEdgeIds, allNodeIds, allEdgeIds)
}

function traceResult(context, primaryNodeIds, primaryEdgeIds, allNodeIds, allEdgeIds) {
  const tables = nodesOfType(allNodeIds, context.nodeById, 'table')
  const endpoints = nodesOfType(allNodeIds, context.nodeById, 'endpoint')
  const nodeIds = context.showAll ? allNodeIds : new Set(primaryNodeIds)
  nodeIds.add(context.selectedId)
  return {
    selectedId: context.selectedId,
    nodeIds,
    edgeIds: context.showAll ? allEdgeIds : primaryEdgeIds,
    primaryNodeIds,
    allNodeIds,
    allEdgeIds,
    pathCount: Math.max(1, endpoints.length, tables.length),
    tableCount: tables.length,
    endpointCount: endpoints.length,
    complete: Boolean(context.leftPath.found && context.rightPath.found),
    missingStart: !context.leftPath.found,
    missingPersistence: !context.rightPath.found,
    continuedFromAncestor: context.continuedFromAncestor,
    entryPoints: context.entryPoints,
    showAll: context.showAll
  }
}

function nodesOfType(ids, nodeById, type) {
  return [...ids].map((id) => nodeById.get(id)).filter((node) => node?.type === type)
}

function contextTokens(selected, ancestorIds, nodeById, entryPoints) {
  const tokens = [...traceSearchTokens(selected)]
  for (const id of ancestorIds.slice(1)) {
    const ancestor = nodeById.get(id)
    if (isContinuationContainer(selected, ancestor, entryPoints)) {
      tokens.push(...traceSearchTokens(ancestor))
    }
  }
  return [...new Set(tokens)]
}

function isContinuationContainer(selected, ancestor, entryPoints) {
  if (!selected || !ancestor || ancestor.module !== selected.module) {
    return false
  }
  if (isFrontendOrigin(ancestor, entryPoints)) {
    return false
  }
  return ['route', 'page', 'main-component', 'component', 'subcomponent'].includes(ancestor.type)
}
