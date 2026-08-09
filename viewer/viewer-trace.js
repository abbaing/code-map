const TRACE_EDGE_TYPES = new Set([
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

const SYSTEM_MODULE_EDGE_TYPES = new Set(['imports', 'lazy-imports', 'calls-api', 'sends', 'handled-by', 'depends-on'])

const TRACE_STAGE_DEFINITIONS = [
  { id: 'route-root', label: 'Route component' },
  { id: 'route', label: 'Feature route' },
  { id: 'page', label: 'Views' },
  { id: 'main', label: 'Main component' },
  { id: 'component', label: 'Components' },
  { id: 'subcomponent', label: 'Subcomponents' },
  { id: 'support', label: 'Hooks / support' },
  { id: 'front-service', label: 'Frontend services' },
  { id: 'front-repository', label: 'API clients' },
  { id: 'endpoint', label: 'Backend entry' },
  { id: 'request', label: 'Command / Query' },
  { id: 'handler', label: 'Handlers' },
  { id: 'back-service', label: 'Backend services' },
  { id: 'back-repository', label: 'Repositories' },
  { id: 'entity', label: 'EF entities' },
  { id: 'table', label: 'Database tables' }
]

function buildTraceContext(graph, selectedId, showAll = false) {
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
  const preferredTokens = traceContextTokens(selected, leftPath.nodes, nodeById, entryPoints)
  let rightPath = shortestTracePath(selectedId, outgoing, nodeById, isPersistenceTarget, preferredTokens)
  if (!rightPath.found) {
    rightPath = shortestTracePath(selectedId, outgoing, nodeById, (node) => node?.type === 'entity', preferredTokens)
  }
  let continuedFromAncestor = null
  if (!rightPath.found && ['component', 'subcomponent', 'hook'].includes(selected.type)) {
    for (const ancestorId of leftPath.nodes.slice(1)) {
      const ancestor = nodeById.get(ancestorId)
      if (!isTraceContinuationContainer(selected, ancestor, entryPoints)) {
        continue
      }
      let candidate = shortestTracePath(ancestorId, outgoing, nodeById, isPersistenceTarget, preferredTokens)
      if (!candidate.found) {
        candidate = shortestTracePath(
          ancestorId,
          outgoing,
          nodeById,
          (node) => node?.type === 'entity',
          preferredTokens
        )
      }
      if (!candidate.found) {
        continue
      }
      rightPath = candidate
      continuedFromAncestor = ancestorId
      break
    }
  }
  const primaryNodeIds = mergePaths(leftPath.nodes.slice().reverse(), rightPath.nodes.slice(1))
  const primaryEdgeIds = new Set([...leftPath.edges, ...rightPath.edges])

  const allNodeIds = allTraceNodeIds(continuedFromAncestor ?? selectedId, outgoing, incoming, nodeById, entryPoints)
  allNodeIds.add(selectedId)
  for (const id of leftPath.nodes) {
    allNodeIds.add(id)
  }
  const allEdgeIds = new Set(
    edges.filter((edge) => allNodeIds.has(edge.from) && allNodeIds.has(edge.to)).map((edge) => edge.id)
  )
  const visibleNodeIds = showAll ? allNodeIds : new Set(primaryNodeIds)
  const visibleEdgeIds = showAll ? allEdgeIds : primaryEdgeIds
  visibleNodeIds.add(selectedId)

  const tables = [...allNodeIds].map((id) => nodeById.get(id)).filter((node) => node?.type === 'table')
  const endpoints = [...allNodeIds].map((id) => nodeById.get(id)).filter((node) => node?.type === 'endpoint')
  return {
    selectedId,
    nodeIds: visibleNodeIds,
    edgeIds: visibleEdgeIds,
    primaryNodeIds,
    allNodeIds,
    allEdgeIds,
    pathCount: Math.max(1, endpoints.length, tables.length),
    tableCount: tables.length,
    endpointCount: endpoints.length,
    complete: Boolean(leftPath.found && rightPath.found),
    missingStart: !leftPath.found,
    missingPersistence: !rightPath.found,
    continuedFromAncestor,
    entryPoints,
    showAll
  }
}

function traceContextTokens(selected, ancestorIds, nodeById, entryPoints) {
  const tokens = [...traceSearchTokens(selected)]
  for (const id of ancestorIds.slice(1)) {
    const ancestor = nodeById.get(id)
    if (!isTraceContinuationContainer(selected, ancestor, entryPoints)) {
      continue
    }
    tokens.push(...traceSearchTokens(ancestor))
  }
  return [...new Set(tokens)]
}

function isTraceContinuationContainer(selected, ancestor, entryPoints) {
  if (!selected || !ancestor) {
    return false
  }
  if (ancestor.module !== selected.module) {
    return false
  }
  if (isFrontendOrigin(ancestor, entryPoints)) {
    return false
  }
  return ['route', 'page', 'main-component', 'component', 'subcomponent'].includes(ancestor.type)
}

function buildModuleTraceContext(graph, module) {
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

  const frontendSeeds = [...moduleNodeIds].filter((id) => nodeById.get(id)?.path?.startsWith('front/'))
  for (const id of reachableFromMany(frontendSeeds, incoming, 20)) {
    if (nodeById.get(id)?.path?.startsWith('front/')) {
      nodeIds.add(id)
    }
  }

  const forward = reachableFromMany(moduleNodeIds, outgoing, 24)
  let persistence = new Set([...forward].filter((id) => nodeById.get(id)?.type === 'table'))
  if (persistence.size === 0) {
    persistence = new Set([...forward].filter((id) => nodeById.get(id)?.type === 'entity'))
  }
  const canReachPersistence = reverseReachableFrom(persistence, incoming)
  for (const id of forward) {
    if (canReachPersistence.has(id)) {
      nodeIds.add(id)
    }
  }

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

function buildSystemModuleGraph(graph, filteredNodes, formatModule = (module) => module) {
  if (!graph) {
    return { nodes: [], edges: [] }
  }
  const sourceNodes = filteredNodes ?? graph.nodes
  const sourceIds = new Set(sourceNodes.map((node) => node.id))
  const modules = new Map()
  for (const node of sourceNodes) {
    const module = node.module || 'shared'
    const summary = modules.get(module) ?? {
      id: `module:${module}`,
      label: formatModule(module),
      type: 'module',
      layer: 'module-overview',
      module,
      meta: { nodeCount: 0, frontendCount: 0, backendCount: 0, findingCount: 0, externalRelations: 0 }
    }
    summary.meta.nodeCount++
    if (node.path?.startsWith('front/')) {
      summary.meta.frontendCount++
    }
    if (node.path?.startsWith('back/')) {
      summary.meta.backendCount++
    }
    summary.meta.findingCount += node.meta?.findings?.length ?? 0
    modules.set(module, summary)
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const aggregated = new Map()
  for (const edge of graph.edges) {
    if (
      !sourceIds.has(edge.from) ||
      !sourceIds.has(edge.to) ||
      !SYSTEM_MODULE_EDGE_TYPES.has(edge.type) ||
      !traceEdgeAllowed(edge, nodeById, graph.edges)
    ) {
      continue
    }
    const fromModule = nodeById.get(edge.from)?.module || 'shared'
    const toModule = nodeById.get(edge.to)?.module || 'shared'
    if (fromModule === toModule || !modules.has(fromModule) || !modules.has(toModule)) {
      continue
    }
    if ((fromModule === 'shared' || toModule === 'shared') && ['imports', 'depends-on'].includes(edge.type)) {
      continue
    }
    const key = `${fromModule}::${toModule}`
    const item = aggregated.get(key) ?? {
      id: `module-edge:${key}`,
      from: `module:${fromModule}`,
      to: `module:${toModule}`,
      type: 'module-dependency',
      count: 0,
      relationTypes: new Set()
    }
    item.count++
    item.relationTypes.add(edge.type)
    aggregated.set(key, item)
  }

  const edges = [...aggregated.values()].map((edge) => ({ ...edge, relationTypes: [...edge.relationTypes].sort() }))
  for (const edge of edges) {
    modules.get(edge.from.slice('module:'.length)).meta.externalRelations++
    modules.get(edge.to.slice('module:'.length)).meta.externalRelations++
  }
  return { nodes: [...modules.values()], edges }
}

function moduleTraceNodeIds(graph, module) {
  return buildModuleTraceContext(graph, module)?.nodeIds ?? new Set()
}

function traceEdgeAllowed(edge, nodeById, graphEdges) {
  if (!TRACE_EDGE_TYPES.has(edge.type)) {
    return false
  }
  const from = nodeById.get(edge.from)
  const to = nodeById.get(edge.to)
  if (!from || !to) {
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

function adjacencyFor(edges, direction) {
  const result = new Map()
  for (const edge of edges) {
    const from = direction === 'outgoing' ? edge.from : edge.to
    const to = direction === 'outgoing' ? edge.to : edge.from
    const bucket = result.get(from) ?? []
    bucket.push({ nodeId: to, edge })
    result.set(from, bucket)
  }
  return result
}

function shortestTracePath(startId, adjacency, nodeById, isTarget, preferredTokens = []) {
  const queue = [{ id: startId, cost: 0 }]
  const costs = new Map([[startId, 0]])
  const previous = new Map()
  let targetId = null

  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id))
    const current = queue.shift()
    if (current.cost !== costs.get(current.id)) {
      continue
    }
    if (isTarget(nodeById.get(current.id))) {
      targetId = current.id
      break
    }
    for (const step of adjacency.get(current.id) ?? []) {
      const nextNode = nodeById.get(step.nodeId)
      const nextCost =
        current.cost +
        Math.max(0.25, traceEdgeWeight(step.edge, nodeById) - traceSemanticBoost(nextNode, preferredTokens)) +
        traceIntentPenalty(nextNode, preferredTokens)
      if (nextCost >= (costs.get(step.nodeId) ?? Infinity)) {
        continue
      }
      costs.set(step.nodeId, nextCost)
      previous.set(step.nodeId, { nodeId: current.id, edgeId: step.edge.id })
      queue.push({ id: step.nodeId, cost: nextCost })
    }
  }

  if (!targetId) {
    return { nodes: [startId], edges: [], found: false }
  }
  const nodes = [targetId]
  const edges = []
  while (nodes.at(-1) !== startId) {
    const step = previous.get(nodes.at(-1))
    if (!step) {
      break
    }
    edges.push(step.edgeId)
    nodes.push(step.nodeId)
  }
  return { nodes: nodes.reverse(), edges: edges.reverse(), found: true }
}

function traceSearchTokens(node) {
  return `${node.label ?? ''}`
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(
      (token) =>
        (token.length >= 4 || token === 'new') &&
        !['index', 'component', 'components', 'feature', 'main'].includes(token)
    )
}

function traceIntentPenalty(node, tokens) {
  if (node?.type !== 'endpoint' || !node.meta?.backend?.action) {
    return 0
  }
  const tokenSet = new Set(tokens)
  const action = node.meta.backend.action.toLowerCase()
  const method = node.meta.method
  if (tokenSet.has('create') || tokenSet.has('new')) {
    return /create|add/.test(action) ? 0 : 8
  }
  if (tokenSet.has('edit') || tokenSet.has('update')) {
    return /update|edit|save|set/.test(action) ? 0 : 8
  }
  if (tokenSet.has('list')) {
    return /list|search|getall/.test(action) || method === 'GET' ? 0 : 6
  }
  if (tokenSet.has('detail') || tokenSet.has('view')) {
    return /get|detail|byid/.test(action) || method === 'GET' ? 0 : 4
  }
  return 0
}

function traceSemanticBoost(node, tokens) {
  if (!node || tokens.length === 0) {
    return 0
  }
  if (!['endpoint', 'query', 'command', 'handler', 'repository', 'entity', 'table'].includes(node.type)) {
    return 0
  }
  const semanticLabel =
    node.type === 'endpoint' && node.meta?.backend?.action ? node.meta.backend.action : (node.label ?? '')
  const words = semanticLabel
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((word) => (word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word))
    .filter(
      (word) =>
        word.length >= 4 && !['command', 'query', 'handler', 'repository', 'controller', 'endpoint'].includes(word)
    )
  const normalizedTokens = new Set(
    tokens.map((token) => (token.length > 4 && token.endsWith('s') ? token.slice(0, -1) : token))
  )
  const matchedWords = words.filter((word) => normalizedTokens.has(word))
  if (words.length > 0 && matchedWords.length === words.length) {
    return 1.75
  }
  const haystack = `${semanticLabel} ${node.path ?? ''}`.toLowerCase()
  return tokens.some((token) => haystack.includes(token)) ? 0.75 : 0
}

function traceEdgeWeight(edge, nodeById) {
  const confidencePenalty = edge.confidence === 'high' ? 0 : edge.confidence === 'medium' ? 1 : 3
  const from = nodeById.get(edge.from)
  const isPersistenceAdapter = from?.type === 'repository'
  const shortcutPenalty =
    edge.type === 'queries-table'
      ? isPersistenceAdapter
        ? 2
        : 8
      : edge.type === 'uses-entity' && !isPersistenceAdapter
        ? 4
        : 0
  return 1 + confidencePenalty + shortcutPenalty
}

function allTraceNodeIds(selectedId, outgoing, incoming, nodeById, entryPoints) {
  const forward = boundedReachable(selectedId, outgoing)
  const backward = boundedReachable(selectedId, incoming)
  let persistence = new Set([...forward].filter((id) => isPersistenceTarget(nodeById.get(id))))
  if (persistence.size === 0) {
    persistence = new Set([...forward].filter((id) => nodeById.get(id)?.type === 'entity'))
  }
  const origins = new Set([...backward].filter((id) => isFrontendOrigin(nodeById.get(id), entryPoints)))
  const canReachPersistence = reverseReachableFrom(persistence, incoming)
  const reachableFromOrigin = reverseReachableFrom(origins, outgoing)
  const result = new Set([selectedId])
  for (const id of forward) {
    if (canReachPersistence.has(id)) {
      result.add(id)
    }
  }
  for (const id of backward) {
    if (reachableFromOrigin.has(id)) {
      result.add(id)
    }
  }
  return result
}

function boundedReachable(startId, adjacency, maxDepth = 28) {
  const seen = new Set([startId])
  const queue = [{ id: startId, depth: 0 }]
  while (queue.length) {
    const current = queue.shift()
    if (current.depth >= maxDepth) {
      continue
    }
    for (const step of adjacency.get(current.id) ?? []) {
      if (seen.has(step.nodeId)) {
        continue
      }
      seen.add(step.nodeId)
      queue.push({ id: step.nodeId, depth: current.depth + 1 })
    }
  }
  return seen
}

function reachableFromMany(seeds, adjacency, maxDepth) {
  const result = new Set()
  for (const seed of seeds) {
    for (const id of boundedReachable(seed, adjacency, maxDepth)) {
      result.add(id)
    }
  }
  return result
}

function reverseReachableFrom(seeds, reverseAdjacency) {
  const result = new Set()
  for (const seed of seeds) {
    for (const id of boundedReachable(seed, reverseAdjacency)) {
      result.add(id)
    }
  }
  return result
}

function isFrontendOrigin(node, entryPoints) {
  if (node?.type !== 'route') {
    return false
  }
  return entryPoints.length === 0 || entryPoints.includes(node.path)
}

function isPersistenceTarget(node) {
  return node?.type === 'table'
}

function mergePaths(left, right) {
  const result = []
  for (const id of [...left, ...right]) {
    if (!result.includes(id)) {
      result.push(id)
    }
  }
  return result
}

function traceStage(node, entryPoints) {
  if (node.type === 'route') {
    return isFrontendOrigin(node, entryPoints) ? 'route-root' : 'route'
  }
  if (node.type === 'page') {
    return 'page'
  }
  if (node.type === 'main-component') {
    return 'main'
  }
  if (node.type === 'component') {
    return 'component'
  }
  if (node.type === 'subcomponent') {
    return 'subcomponent'
  }
  if (node.type === 'hook' || node.layer === 'auxiliary') {
    return 'support'
  }
  if (node.type === 'endpoint') {
    return 'endpoint'
  }
  if (['command', 'query'].includes(node.type)) {
    return 'request'
  }
  if (node.type === 'handler') {
    return 'handler'
  }
  if (node.type === 'entity') {
    return 'entity'
  }
  if (node.type === 'table') {
    return 'table'
  }
  if (node.type === 'data-context') {
    return 'back-repository'
  }
  if (node.type === 'service') {
    return node.layer === 'backend-service' ? 'back-service' : 'front-service'
  }
  if (node.type === 'repository') {
    return node.layer === 'backend-repository' ? 'back-repository' : 'front-repository'
  }
  return node.path?.startsWith('back/') ? 'back-service' : 'support'
}

function nodeHeight(node, view = 'graph') {
  if (view === 'domain' && node.type === 'entity') {
    const propertyCount = Math.min(node.meta?.domain?.properties?.length ?? 0, 10)
    const hasMore = (node.meta?.domain?.properties?.length ?? 0) > propertyCount
    return Math.max(104, 52 + propertyCount * 16 + (hasMore ? 20 : 10))
  }
  return node.meta?.quality ? 66 : 52
}

function applyTraceFocusLayout(layout, trace, width, height, view = 'graph') {
  if (!trace) {
    return layout
  }
  const stageIndex = new Map(TRACE_STAGE_DEFINITIONS.map((stage, index) => [stage.id, index]))
  const focused = layout.nodes.filter((node) => trace.nodeIds.has(node.id))
  const primaryOrder = new Map(trace.primaryNodeIds.map((id, index) => [id, index]))
  const byStage = new Map()
  for (const node of focused) {
    const stage = traceStage(node, trace.entryPoints ?? [])
    const bucket = byStage.get(stage) ?? []
    bucket.push(node)
    byStage.set(stage, bucket)
  }

  const left = 56
  const top = 76
  const columnWidth = 198
  const stageGap = 22
  const rowHeight = 88
  const traceHeight = Math.max(
    330,
    top + Math.max(1, ...[...byStage.values()].map((items) => items.length)) * rowHeight + 70
  )
  const tracePositions = new Map()
  for (const [stage, items] of byStage) {
    items.sort(
      (a, b) => (primaryOrder.get(a.id) ?? 9999) - (primaryOrder.get(b.id) ?? 9999) || a.label.localeCompare(b.label)
    )
    const column = stageIndex.get(stage) ?? 0
    items.forEach((node, row) => {
      const supportOffset = stage === 'support' ? 34 : 0
      tracePositions.set(node.id, {
        x: left + column * (columnWidth + stageGap),
        y: top + row * rowHeight + supportOffset,
        width: columnWidth - 18,
        height: nodeHeight(node, view)
      })
    })
  }

  const nodes = layout.nodes.map((node) =>
    tracePositions.has(node.id) ? { ...node, ...tracePositions.get(node.id) } : { ...node, y: node.y + traceHeight }
  )
  const stageLabels = TRACE_STAGE_DEFINITIONS.filter((stage) => byStage.has(stage.id)).map((stage) => ({
    layer: stage.id,
    label: stage.label,
    x: left + stageIndex.get(stage.id) * (columnWidth + stageGap),
    width: columnWidth - 18
  }))

  return {
    ...layout,
    nodes,
    layerLabels: stageLabels,
    moduleLabels: trace.moduleOverview ? [] : layout.moduleLabels.map((item) => ({ ...item, y: item.y + traceHeight })),
    traceBoundaryX: left + stageIndex.get('endpoint') * (columnWidth + stageGap) - stageGap / 2,
    traceHeight,
    width: Math.max(layout.width, left + TRACE_STAGE_DEFINITIONS.length * (columnWidth + stageGap), width),
    height: Math.max(layout.height + traceHeight, height)
  }
}

export {
  applyTraceFocusLayout,
  buildModuleTraceContext,
  buildSystemModuleGraph,
  buildTraceContext,
  moduleTraceNodeIds,
  nodeHeight
}
