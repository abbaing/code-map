import { state } from '#viewer/viewer-state.js'

export function focusedNodeIds(selectedId, edges) {
  if (!selectedId) {
    return null
  }
  const ids = new Set([selectedId])
  for (const edge of edges) {
    if (edge.from === selectedId) {
      ids.add(edge.to)
    }
    if (edge.to === selectedId) {
      ids.add(edge.from)
    }
  }
  return ids
}

export function connectedEdgeIds(nodeId) {
  if (!nodeId) {
    return new Set()
  }
  return new Set(state.graph.edges.filter((edge) => edge.from === nodeId || edge.to === nodeId).map((edge) => edge.id))
}

export function isDimmedNode(node, focusedIds) {
  return Boolean(focusedIds && !focusedIds.has(node.id))
}

export function isDimmedEdge(edge, focusedIds) {
  return Boolean(focusedIds && (!focusedIds.has(edge.from) || !focusedIds.has(edge.to)))
}

export function isFocusedNode(node, focusedIds) {
  return Boolean(focusedIds?.has(node.id))
}

export function isFocusedEdge(edge, focusedIds) {
  return Boolean(focusedIds?.has(edge.from) && focusedIds?.has(edge.to))
}
