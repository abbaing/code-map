import { state } from '#viewer/viewer-state.js'
import { nodeHeight } from '#viewer/viewer-trace.js'

export function gridPlaceDomainCluster(cluster, cardWidth, columnGap, rowGap) {
  const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(cluster.nodes.length))))
  const rows = Math.ceil(cluster.nodes.length / columns)
  const rowHeights = Array.from({ length: rows }, (_, row) => {
    const rowNodes = cluster.nodes.slice(row * columns, row * columns + columns)
    return Math.max(...rowNodes.map((node) => nodeHeight(node, state.view)), 120)
  })
  const positions = new Map()
  const rowOffsets = []
  let offset = 0
  for (const rowHeight of rowHeights) {
    rowOffsets.push(offset)
    offset += rowHeight + rowGap
  }
  cluster.nodes.forEach((node, index) => {
    const row = Math.floor(index / columns)
    positions.set(node.id, { x: (index % columns) * (cardWidth + columnGap), y: rowOffsets[row] })
  })
  return {
    positions,
    width: columns * cardWidth + Math.max(0, columns - 1) * columnGap,
    height: rowHeights.reduce((sum, value) => sum + value, 0) + Math.max(0, rows - 1) * rowGap
  }
}
