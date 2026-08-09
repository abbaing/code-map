import { calculateGraphDigest, calculateSubmapUid } from './digest.mjs'
import { ACCESS_LEVELS, normalizeRequest, resolveSeeds, resolveSelectorNodeIds, selectorIsEmpty } from './selectors.mjs'
import { SubmapError } from './errors.mjs'

export function createSubmap(graph, request, options = {}) {
  const clock = options.clock
  const hash = options.hash
  if (!options.createdAt && !clock) {
    throw new TypeError('Submap creation requires a clock capability.')
  }
  if (!hash) {
    throw new TypeError('Submap creation requires a hash capability.')
  }
  assertGraph(graph)
  const normalized = normalizeRequest(request)
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  assertExplicitNodeIdsExist(nodeById, normalized.exclusions, 'SUBMAP_EXCLUSION_NODE_NOT_FOUND')
  for (const level of ACCESS_LEVELS) {
    assertExplicitNodeIdsExist(nodeById, normalized.access[level], 'SUBMAP_ACCESS_NODE_NOT_FOUND', { access: level })
  }
  const seeds = resolveSeeds(graph, normalized.selectors)
  const excludedIds = resolveSelectorNodeIds(graph.nodes, normalized.exclusions)
  const forbiddenIds = resolveSelectorNodeIds(graph.nodes, normalized.access.forbidden)
  const conflictingSeeds = [...seeds].filter((id) => excludedIds.has(id))
  if (conflictingSeeds.length) {
    throw new SubmapError('SUBMAP_SEED_EXCLUDED', 'Explicit selection and exclusions resolve to the same node.', {
      nodeIds: conflictingSeeds.sort()
    })
  }

  const eligibleEdges = graph.edges.filter((edge) => edgeAllowed(edge, normalized.traversal))
  const adjacency = buildAdjacency(eligibleEdges, normalized.traversal.direction)
  const includedIds = traverse(seeds, adjacency, excludedIds, forbiddenIds, normalized.traversal.maxDepth)
  const nodes = [...includedIds]
    .map((id) => nodeById.get(id))
    .filter(Boolean)
    .sort(byId)
    .map(clone)
  const edges = eligibleEdges
    .filter((edge) => includedIds.has(edge.from) && includedIds.has(edge.to))
    .sort(byId)
    .map(clone)
  const boundaries = buildBoundaries(eligibleEdges, includedIds, excludedIds, nodeById)
  const findings = (graph.findings ?? [])
    .filter((finding) => finding.nodeId && includedIds.has(finding.nodeId))
    .sort(byId)
    .map(clone)
  const orphanNodeIds = (graph.orphans ?? [])
    .map((item) => (typeof item === 'string' ? item : item.id))
    .filter((id) => includedIds.has(id))
    .sort()
  const access = resolveAccess(nodes, normalized.access)

  const submap = {
    kind: 'code-map/submap',
    schemaVersion: 1,
    id: normalized.id,
    uid: '',
    revision: normalized.revision,
    parentUid: normalized.parentUid,
    createdAt: options.createdAt ?? clock.nowIso(),
    source: {
      graphVersion: graph.version,
      graphDigest: calculateGraphDigest(graph, hash),
      graphGeneratedAt: graph.generatedAt,
      projectName: graph.projectMap?.project?.name ?? 'Unknown project',
      ...(options.git ? { git: options.git } : {})
    },
    selection: {
      seeds: normalized.selectors,
      resolvedSeedNodeIds: [...seeds].sort(),
      traversal: normalized.traversal,
      exclusions: normalized.exclusions
    },
    access,
    nodes,
    edges,
    findings,
    orphanNodeIds,
    boundaries,
    catalog: buildCatalog(graph),
    statistics: buildStatistics(nodes, edges, findings, boundaries, access),
    warnings: buildWarnings(normalized, boundaries),
    metadata: clone(normalized.metadata)
  }
  submap.uid = calculateSubmapUid(submap, hash)
  return submap
}

function traverse(seeds, adjacency, excludedIds, forbiddenIds, maxDepth) {
  const included = new Set()
  const queue = [...seeds].sort().map((id) => ({ id, depth: 0 }))
  const bestDepth = new Map(queue.map((item) => [item.id, 0]))
  while (queue.length) {
    const current = queue.shift()
    if (excludedIds.has(current.id)) {
      continue
    }
    included.add(current.id)
    if (current.depth >= maxDepth || forbiddenIds.has(current.id)) {
      continue
    }
    for (const neighbor of adjacency.get(current.id) ?? []) {
      if (excludedIds.has(neighbor)) {
        continue
      }
      const depth = current.depth + 1
      if ((bestDepth.get(neighbor) ?? Infinity) <= depth) {
        continue
      }
      bestDepth.set(neighbor, depth)
      queue.push({ id: neighbor, depth })
    }
  }
  return included
}

function buildAdjacency(edges, direction) {
  const adjacency = new Map()
  const add = (from, to) => {
    const current = adjacency.get(from) ?? new Set()
    current.add(to)
    adjacency.set(from, current)
  }
  for (const edge of edges) {
    if (direction !== 'incoming') {
      add(edge.from, edge.to)
    }
    if (direction !== 'outgoing') {
      add(edge.to, edge.from)
    }
  }
  return new Map([...adjacency].map(([id, values]) => [id, [...values].sort()]))
}

function buildBoundaries(edges, includedIds, excludedIds, nodeById) {
  const boundaries = []
  for (const edge of edges) {
    const fromInside = includedIds.has(edge.from)
    const toInside = includedIds.has(edge.to)
    if (fromInside === toInside) {
      continue
    }
    const outsideId = fromInside ? edge.to : edge.from
    const outside = nodeById.get(outsideId)
    if (!outside) {
      continue
    }
    boundaries.push({
      edgeId: edge.id,
      insideNodeId: fromInside ? edge.from : edge.to,
      direction: fromInside ? 'outgoing' : 'incoming',
      outsideNode: pickBoundaryNode(outside),
      reason: excludedIds.has(outsideId) ? 'excluded' : 'depth-limit'
    })
  }
  return boundaries.sort((a, b) => a.edgeId.localeCompare(b.edgeId))
}

function resolveAccess(nodes, rules) {
  const matches = Object.fromEntries(ACCESS_LEVELS.map((level) => [level, resolveSelectorNodeIds(nodes, rules[level])]))
  const conflicts = [...matches.editable].filter((id) => matches.forbidden.has(id))
  if (conflicts.length) {
    throw new SubmapError(
      'SUBMAP_ACCESS_CONFLICT',
      'Nodes cannot be both editable and forbidden.',
      { nodeIds: conflicts.sort() },
      4
    )
  }

  const precedence = ['forbidden', 'generated', 'editable', 'readable', 'external']
  const resolved = Object.fromEntries(ACCESS_LEVELS.map((level) => [level, []]))
  for (const node of nodes) {
    const level = precedence.find((candidate) => matches[candidate].has(node.id)) ?? rules.default
    resolved[level].push(node.id)
  }
  for (const values of Object.values(resolved)) {
    values.sort()
  }
  return { default: rules.default, ...resolved }
}

function buildCatalog(graph) {
  return clone({
    moduleLabels: graph.projectMap?.modules?.labels ?? {},
    layerLabels: Object.fromEntries((graph.projectMap?.layers ?? []).map((layer) => [layer.id, layer.label])),
    typeLabels: graph.projectMap?.types?.labels ?? {},
    ruleMetadata: graph.ruleMetadata ?? {}
  })
}

function buildStatistics(nodes, edges, findings, boundaries, access) {
  return {
    nodes: nodes.length,
    edges: edges.length,
    findings: findings.length,
    boundaries: boundaries.length,
    editable: access.editable.length,
    readable: access.readable.length,
    external: access.external.length,
    forbidden: access.forbidden.length,
    generated: access.generated.length
  }
}

function buildWarnings(request, boundaries) {
  const warnings = []
  if (boundaries.length) {
    warnings.push(`${boundaries.length} relation${boundaries.length === 1 ? '' : 's'} cross the selected perimeter.`)
  }
  if (request.access.default === 'readable' && selectorIsEmpty(request.access.editable)) {
    warnings.push('No nodes were explicitly classified as editable.')
  }
  return warnings
}

function edgeAllowed(edge, traversal) {
  if (traversal.excludedEdgeTypes.includes(edge.type)) {
    return false
  }
  return traversal.edgeTypes.length === 0 || traversal.edgeTypes.includes(edge.type)
}

function pickBoundaryNode(node) {
  return Object.fromEntries(
    ['id', 'label', 'type', 'layer', 'module', 'path']
      .filter((key) => node[key] !== undefined)
      .map((key) => [key, node[key]])
  )
}

function assertGraph(graph) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new SubmapError('SUBMAP_INVALID_GRAPH', 'A code-map graph with nodes and edges is required.', {}, 4)
  }
}

function assertExplicitNodeIdsExist(nodeById, selector, code, details = {}) {
  const missing = selector.nodeIds.filter((id) => !nodeById.has(id))
  if (missing.length) {
    throw new SubmapError(
      code,
      'An explicit selector references nodes absent from the source graph.',
      { ...details, nodeIds: missing },
      3
    )
  }
}

function byId(a, b) {
  return a.id.localeCompare(b.id)
}

function clone(value) {
  return structuredClone(value)
}
