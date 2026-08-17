export function submapAvailability(submap, graph) {
  const currentNodeIds = new Set(graph.nodes.map(({ id }) => id))
  const availableNodes = []
  const missingNodes = []
  for (const node of submap.nodes) {
    if (currentNodeIds.has(node.id)) {
      availableNodes.push(node)
    } else {
      missingNodes.push(node)
    }
  }
  return Object.freeze({ availableNodes, missingNodes })
}
