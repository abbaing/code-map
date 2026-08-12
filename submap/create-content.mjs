import { buildBoundaries } from '#submap/create-projection.mjs'
import { ACCESS_LEVELS } from '#submap/selectors.mjs'
import { resolveNodeAccess, selectNodeIds } from '#submap/strategies.mjs'

export function createSubmapContent(graph, request, strategies, selection) {
  const { includedIds, eligibleEdges, excludedIds, nodeById } = selection
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
  return {
    access: createAccess(graph, nodes, request, strategies),
    nodes,
    edges,
    findings: (graph.findings ?? [])
      .filter((finding) => finding.nodeId && includedIds.has(finding.nodeId))
      .sort(byId)
      .map(clone),
    orphanNodeIds: (graph.orphans ?? [])
      .map((item) => (typeof item === 'string' ? item : item.id))
      .filter((id) => includedIds.has(id))
      .sort(),
    boundaries
  }
}

function createAccess(graph, nodes, request, strategies) {
  const matches = Object.fromEntries(
    ACCESS_LEVELS.map((level) => [
      level,
      selectNodeIds(strategies.selection, nodes, request.access[level], `${level} access`, graph.nodes)
    ])
  )
  return resolveNodeAccess(strategies.access, { nodes, rules: request.access, matches })
}

function byId(a, b) {
  return a.id.localeCompare(b.id)
}

function clone(value) {
  return structuredClone(value)
}
