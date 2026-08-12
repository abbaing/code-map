import { selectorIsEmpty } from '#submap/selectors.mjs'

export function buildBoundaries(edges, includedIds, excludedIds, nodeById) {
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

export function buildCatalog(graph) {
  return structuredClone({
    moduleLabels: graph.projectMap?.modules?.labels ?? {},
    layerLabels: Object.fromEntries((graph.projectMap?.layers ?? []).map((layer) => [layer.id, layer.label])),
    typeLabels: graph.projectMap?.types?.labels ?? {},
    ruleMetadata: graph.ruleMetadata ?? {}
  })
}

export function buildStatistics(nodes, edges, findings, boundaries, access) {
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

export function buildWarnings(request, boundaries) {
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
