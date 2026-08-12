import { state } from '#viewer/viewer-state.js'

export function inferAuxiliaryLayers(nodes) {
  const visible = new Map(nodes.map((node) => [node.id, node]))
  const inferred = new Map()
  for (const node of nodes) {
    if (node.layer !== 'auxiliary') {
      continue
    }
    const edge = state.graph.edges.find((candidate) => connectedToNonAuxiliary(candidate, node.id, visible))
    if (!edge) {
      continue
    }
    const otherId = edge.from === node.id ? edge.to : edge.from
    inferred.set(node.id, visible.get(otherId).layer)
  }
  return inferred
}

export function moduleWeight(module) {
  return module === sharedModule() ? 999 : 0
}

export function nodeSortWeight(node) {
  const name = `${node.label} ${node.path ?? ''}`.toLowerCase()
  const weights = [
    ['routes', 0],
    ['page', 1],
    ['main', 2],
    ['index', 3],
    ['repository', 8],
    ['controller', 9],
    ['handler', 10]
  ]
  return weights.find(([token]) => name.includes(token))?.[1] ?? 5
}

function connectedToNonAuxiliary(edge, nodeId, visible) {
  if (edge.from !== nodeId && edge.to !== nodeId) {
    return false
  }
  const otherId = edge.from === nodeId ? edge.to : edge.from
  const other = visible.get(otherId)
  return Boolean(other && other.layer !== 'auxiliary')
}

function sharedModule() {
  return state.graph.projectMap?.modules?.shared ?? 'shared'
}
