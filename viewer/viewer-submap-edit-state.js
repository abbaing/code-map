export function isSubmapSelectionDirty(activeSubmap, selectedNodeIds) {
  if (!activeSubmap) {
    return false
  }
  const baseline = activeSubmap.nodeIds
  return baseline.size !== selectedNodeIds.size || [...baseline].some((nodeId) => !selectedNodeIds.has(nodeId))
}
