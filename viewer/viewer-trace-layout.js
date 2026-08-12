import { nodeHeight, TRACE_STAGE_DEFINITIONS, traceStage } from '#viewer/viewer-trace-policy.js'

export function applyTraceFocusLayout(layout, trace, width, height, view = 'graph') {
  if (!trace) {
    return layout
  }
  const stageIndex = new Map(TRACE_STAGE_DEFINITIONS.map((stage, index) => [stage.id, index]))
  const primaryOrder = new Map(trace.primaryNodeIds.map((id, index) => [id, index]))
  const byStage = groupByStage(layout.nodes, trace, primaryOrder)
  const dimensions = traceDimensions(byStage)
  const tracePositions = positionTraceNodes(byStage, stageIndex, dimensions, view)
  const nodes = layout.nodes.map((node) =>
    tracePositions.has(node.id)
      ? { ...node, ...tracePositions.get(node.id) }
      : { ...node, y: node.y + dimensions.traceHeight }
  )
  return {
    ...layout,
    nodes,
    layerLabels: stageLabels(byStage, stageIndex, dimensions),
    moduleLabels: trace.moduleOverview
      ? []
      : layout.moduleLabels.map((item) => ({ ...item, y: item.y + dimensions.traceHeight })),
    traceBoundaryX: dimensions.left + stageIndex.get('endpoint') * dimensions.step - dimensions.stageGap / 2,
    traceHeight: dimensions.traceHeight,
    width: Math.max(layout.width, dimensions.left + TRACE_STAGE_DEFINITIONS.length * dimensions.step, width),
    height: Math.max(layout.height + dimensions.traceHeight, height)
  }
}

function groupByStage(nodes, trace, primaryOrder) {
  const byStage = new Map()
  for (const node of nodes.filter((item) => trace.nodeIds.has(item.id))) {
    const stage = traceStage(node, trace.entryPoints ?? [])
    const bucket = byStage.get(stage) ?? []
    bucket.push(node)
    bucket.sort(
      (a, b) => (primaryOrder.get(a.id) ?? 9999) - (primaryOrder.get(b.id) ?? 9999) || a.label.localeCompare(b.label)
    )
    byStage.set(stage, bucket)
  }
  return byStage
}

function traceDimensions(byStage) {
  const top = 76
  const rowHeight = 88
  return {
    left: 56,
    top,
    columnWidth: 198,
    stageGap: 22,
    rowHeight,
    step: 220,
    traceHeight: Math.max(
      330,
      top + Math.max(1, ...[...byStage.values()].map((items) => items.length)) * rowHeight + 70
    )
  }
}

function positionTraceNodes(byStage, stageIndex, dimensions, view) {
  const positions = new Map()
  for (const [stage, items] of byStage) {
    const column = stageIndex.get(stage) ?? 0
    items.forEach((node, row) => {
      const supportOffset = stage === 'support' ? 34 : 0
      positions.set(node.id, {
        x: dimensions.left + column * dimensions.step,
        y: dimensions.top + row * dimensions.rowHeight + supportOffset,
        width: dimensions.columnWidth - 18,
        height: nodeHeight(node, view)
      })
    })
  }
  return positions
}

function stageLabels(byStage, stageIndex, dimensions) {
  return TRACE_STAGE_DEFINITIONS.filter((stage) => byStage.has(stage.id)).map((stage) => ({
    layer: stage.id,
    label: stage.label,
    x: dimensions.left + stageIndex.get(stage.id) * dimensions.step,
    width: dimensions.columnWidth - 18
  }))
}
