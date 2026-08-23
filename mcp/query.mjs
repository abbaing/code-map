export function findGraphNodes(graph, { query = '', type, module, limit = 20 } = {}) {
  const needle = String(query).trim().toLowerCase()
  return graph.nodes
    .filter((node) => !type || node.type === type)
    .filter((node) => !module || node.module === module)
    .filter((node) => !needle || [node.id, node.label, node.path, node.module].some((value) => matches(value, needle)))
    .slice(0, bounded(limit, 1, 100))
    .map(nodeSummary)
}

export function graphDependencies(graph, { nodeId, direction = 'outgoing', depth = 1, edgeTypes } = {}) {
  requireNode(graph, nodeId)
  const allowedTypes = edgeTypes?.length ? new Set(edgeTypes) : null
  const visited = new Set([nodeId])
  const levels = new Map([[nodeId, 0]])
  const selectedEdges = []
  let frontier = [nodeId]
  for (let level = 1; level <= bounded(depth, 0, 8) && frontier.length; level += 1) {
    const next = []
    for (const [edge, neighbor] of levelRelations(graph.edges, frontier, direction, allowedTypes)) {
      selectedEdges.push(edge)
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        levels.set(neighbor, level)
        next.push(neighbor)
      }
    }
    frontier = next
  }
  const nodes = graph.nodes
    .filter((node) => visited.has(node.id))
    .map((node) => ({ ...nodeSummary(node), depth: levels.get(node.id) }))
  return { root: nodeId, direction, nodes, edges: uniqueEdges(selectedEdges).map(edgeSummary) }
}

export function graphImpact(graph, { nodeId, depth = 3, edgeTypes } = {}) {
  return graphDependencies(graph, { nodeId, depth, edgeTypes, direction: 'incoming' })
}

export function graphTrace(graph, { nodeId, targetId, maxDepth = 8 } = {}) {
  const source = requireNode(graph, nodeId)
  if (targetId) {
    requireNode(graph, targetId)
  }
  const direction = source.type === 'table' ? 'incoming' : 'outgoing'
  const targets = targetId ? new Set([targetId]) : defaultTraceTargets(graph, direction)
  const queue = [{ id: nodeId, path: [nodeId], edges: [] }]
  const paths = []
  const bestDepth = new Map([[nodeId, 0]])
  while (queue.length && paths.length < 20) {
    const current = queue.shift()
    processTraceStep({
      graph,
      current,
      direction,
      targets,
      stopAtTarget: Boolean(targetId),
      maxDepth,
      bestDepth,
      queue,
      paths
    })
  }
  return { root: nodeId, direction, paths }
}

function processTraceStep(context) {
  const { graph, current, direction, targets, stopAtTarget, maxDepth, bestDepth, queue, paths } = context
  if (current.path.length > 1 && targets.has(current.id)) {
    paths.push(current)
    if (stopAtTarget) {
      return
    }
  }
  if (current.edges.length >= bounded(maxDepth, 1, 12)) {
    return
  }
  for (const edge of adjacentEdges(graph.edges, current.id, direction)) {
    enqueueTraceNeighbor({ edge, current, direction, bestDepth, queue })
  }
}

function enqueueTraceNeighbor({ edge, current, direction, bestDepth, queue }) {
  const nextId = direction === 'incoming' ? edge.from : edge.to
  const nextDepth = current.edges.length + 1
  if (current.path.includes(nextId) || (bestDepth.get(nextId) ?? Infinity) < nextDepth) {
    return
  }
  bestDepth.set(nextId, nextDepth)
  queue.push({ id: nextId, path: [...current.path, nextId], edges: [...current.edges, edge.id] })
}

function levelRelations(edges, frontier, direction, allowedTypes) {
  const ids = new Set(frontier)
  return edges
    .filter((edge) => !allowedTypes || allowedTypes.has(edge.type))
    .map((edge) => [edge, neighborOf(edge, ids, direction)])
    .filter(([, neighbor]) => neighbor)
}

function defaultTraceTargets(graph, direction) {
  const types =
    direction === 'incoming' ? ['route', 'page', 'component'] : ['endpoint', 'handler', 'repository', 'entity', 'table']
  return new Set(graph.nodes.filter((node) => types.includes(node.type)).map((node) => node.id))
}

function adjacentEdges(edges, nodeId, direction) {
  return edges.filter((edge) => (direction === 'incoming' ? edge.to === nodeId : edge.from === nodeId))
}

function neighborOf(edge, frontier, direction) {
  if (direction !== 'incoming' && frontier.has(edge.from)) {
    return edge.to
  }
  if (direction !== 'outgoing' && frontier.has(edge.to)) {
    return edge.from
  }
  return null
}

function requireNode(graph, nodeId) {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId)
  if (!node) {
    throw new Error(`Graph node not found: ${nodeId}`)
  }
  return node
}

function nodeSummary(node) {
  return {
    id: node.id,
    label: node.label,
    type: node.type,
    layer: node.layer,
    module: node.module,
    path: node.path,
    meta: node.meta
  }
}

function edgeSummary(edge) {
  return {
    id: edge.id,
    from: edge.from,
    to: edge.to,
    type: edge.type,
    confidence: edge.confidence,
    evidence: edge.evidence
  }
}

function uniqueEdges(edges) {
  return [...new Map(edges.map((edge) => [edge.id, edge])).values()]
}

function matches(value, needle) {
  return value !== undefined && String(value).toLowerCase().includes(needle)
}

function bounded(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number.isInteger(value) ? value : minimum))
}
