export function layoutSystemModules(nodes, width, height) {
  const sorted = [...nodes].sort((a, b) => {
    if (a.module === 'shared') {
      return -1
    }
    if (b.module === 'shared') {
      return 1
    }
    return b.meta.externalRelations - a.meta.externalRelations || a.label.localeCompare(b.label)
  })
  const columns = Math.min(5, Math.max(2, Math.ceil(Math.sqrt(sorted.length * 1.4))))
  const cardWidth = 224
  const cardHeight = 76
  const columnGap = 88
  const rowGap = 68
  const left = 64
  const top = 62
  const positioned = sorted.map((node, index) => ({
    ...node,
    x: left + (index % columns) * (cardWidth + columnGap),
    y: top + Math.floor(index / columns) * (cardHeight + rowGap),
    width: cardWidth,
    height: cardHeight
  }))
  const rows = Math.ceil(sorted.length / columns)
  return {
    nodes: positioned,
    width: Math.max(width, left * 2 + columns * cardWidth + Math.max(0, columns - 1) * columnGap),
    height: Math.max(height, top * 2 + rows * cardHeight + Math.max(0, rows - 1) * rowGap)
  }
}
