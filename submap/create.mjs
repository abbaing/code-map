import { calculateGraphDigest, calculateSubmapUid } from '#submap/digest.mjs'
import { ACCESS_LEVELS, normalizeRequest, selectorIsEmpty } from '#submap/selectors.mjs'
import { SubmapError } from '#submap/errors.mjs'
import { resolveNodeAccess, resolveSubmapStrategies, selectNodeIds, traverseNodeIds } from '#submap/strategies.mjs'

export function createSubmap(graph, request, options = {}) {
  const clock = options.clock
  const hash = options.hash
  const strategies = resolveSubmapStrategies(options.strategies)
  if (!options.createdAt && !clock) {
    throw new TypeError('Submap creation requires a clock capability.')
  }
  if (!hash) {
    throw new TypeError('Submap creation requires a hash capability.')
  }
  assertGraph(graph)
  const normalized = normalizeRequest(request)
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  assertExplicitNodeIdsExist(nodeById, normalized.selectors, 'SUBMAP_SEED_NOT_FOUND')
  assertExplicitNodeIdsExist(nodeById, normalized.exclusions, 'SUBMAP_EXCLUSION_NODE_NOT_FOUND')
  for (const level of ACCESS_LEVELS) {
    assertExplicitNodeIdsExist(nodeById, normalized.access[level], 'SUBMAP_ACCESS_NODE_NOT_FOUND', { access: level })
  }
  const seeds = selectNodeIds(strategies.selection, graph.nodes, normalized.selectors, 'seed selection')
  if (!seeds.size) {
    throw new SubmapError(
      'SUBMAP_NO_SEEDS',
      'The selectors did not resolve any seed nodes.',
      {
        selectors: normalized.selectors
      },
      3
    )
  }
  const excludedIds = selectNodeIds(strategies.selection, graph.nodes, normalized.exclusions, 'exclusions')
  const forbiddenIds = selectNodeIds(strategies.selection, graph.nodes, normalized.access.forbidden, 'forbidden access')
  const conflictingSeeds = [...seeds].filter((id) => excludedIds.has(id))
  if (conflictingSeeds.length) {
    throw new SubmapError('SUBMAP_SEED_EXCLUDED', 'Explicit selection and exclusions resolve to the same node.', {
      nodeIds: conflictingSeeds.sort()
    })
  }

  const { eligibleEdges, includedIds } = traverseNodeIds(strategies.traversal, {
    seeds,
    edges: graph.edges,
    policy: normalized.traversal,
    excludedIds,
    blockedIds: forbiddenIds
  })
  assertTraversalOutput(graph, nodeById, eligibleEdges, includedIds)
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
  const accessMatches = Object.fromEntries(
    ACCESS_LEVELS.map((level) => [
      level,
      selectNodeIds(strategies.selection, nodes, normalized.access[level], `${level} access`, graph.nodes)
    ])
  )
  const access = resolveNodeAccess(strategies.access, { nodes, rules: normalized.access, matches: accessMatches })

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

function assertTraversalOutput(graph, nodeById, eligibleEdges, includedIds) {
  const unknownNodeIds = [...includedIds].filter((id) => !nodeById.has(id))
  if (unknownNodeIds.length > 0) {
    throw new TypeError(`Traversal strategy returned unknown node ids: ${unknownNodeIds.sort().join(', ')}.`)
  }
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]))
  const returnedEdgeIds = eligibleEdges.map((edge) => edge?.id)
  if (returnedEdgeIds.some((id) => typeof id !== 'string')) {
    throw new TypeError('Traversal strategy returned an invalid edge.')
  }
  const duplicateEdgeIds = returnedEdgeIds.filter((id, index) => returnedEdgeIds.indexOf(id) !== index)
  if (duplicateEdgeIds.length > 0) {
    throw new TypeError(
      `Traversal strategy returned duplicate edges: ${[...new Set(duplicateEdgeIds)].sort().join(', ')}.`
    )
  }
  const unknownEdgeIds = returnedEdgeIds.filter((id) => !edgeById.has(id))
  if (unknownEdgeIds.length > 0) {
    throw new TypeError(`Traversal strategy returned unknown edges: ${unknownEdgeIds.sort().join(', ')}.`)
  }
  const changedEdgeIds = eligibleEdges
    .filter((edge) => {
      const source = edgeById.get(edge.id)
      return edge.from !== source.from || edge.to !== source.to || edge.type !== source.type
    })
    .map((edge) => edge.id)
  if (changedEdgeIds.length > 0) {
    throw new TypeError(`Traversal strategy changed graph edges: ${changedEdgeIds.sort().join(', ')}.`)
  }
}

function byId(a, b) {
  return a.id.localeCompare(b.id)
}

function clone(value) {
  return structuredClone(value)
}
