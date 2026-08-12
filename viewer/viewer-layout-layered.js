import { computeLayerLevels, computeModuleLevelByNode } from '#viewer/viewer-layout-layered-levels.js'
import { inferAuxiliaryLayers, moduleWeight, nodeSortWeight } from '#viewer/viewer-layout-layered-policy.js'
import { layerOrder } from '#viewer/viewer-state.js'
import { nodeHeight } from '#viewer/viewer-trace.js'
import { unique } from '#viewer/viewer-utils.js'

export function layoutLayeredNodes(nodes, width, height) {
  const model = buildLayeredModel(nodes)
  const metrics = layoutMetrics(model.layers, model.layerLevels, width)
  const result = []
  const moduleLabels = []
  let currentY = 54
  for (const module of model.modules) {
    currentY = positionModule({ module, model, metrics, currentY, result, moduleLabels })
  }
  return {
    nodes: result,
    width: metrics.contentWidth,
    height: Math.max(height, currentY + 40),
    layerLabels: metrics.layerLabels,
    moduleLabels
  }
}

function buildLayeredModel(nodes) {
  const connectedLayers = inferAuxiliaryLayers(nodes)
  const grouped = new Map()
  const layoutLayerByNode = new Map()
  for (const node of nodes) {
    const module = node.module || 'shared'
    const layer =
      node.layer === 'auxiliary' ? (connectedLayers.get(node.id) ?? 'ui-component-logic') : node.layer || 'unknown'
    layoutLayerByNode.set(node.id, layer)
    const moduleGroup = grouped.get(module) ?? new Map()
    const items = moduleGroup.get(layer) ?? []
    items.push(node)
    moduleGroup.set(layer, items)
    grouped.set(module, moduleGroup)
  }
  const layers = orderedLayers(nodes, connectedLayers)
  return {
    nodes,
    grouped,
    layoutLayerByNode,
    layers,
    modules: [...grouped.keys()].sort((a, b) => moduleWeight(a) - moduleWeight(b) || a.localeCompare(b)),
    layerLevels: computeLayerLevels(nodes, layers, layoutLayerByNode)
  }
}

function orderedLayers(nodes, connectedLayers) {
  return unique(
    nodes.map((node) =>
      node.layer === 'auxiliary' ? (connectedLayers.get(node.id) ?? 'ui-component-logic') : node.layer || 'unknown'
    )
  ).sort((a, b) => {
    const first = layerOrder.indexOf(a)
    const second = layerOrder.indexOf(b)
    return (first === -1 ? 999 : first) - (second === -1 ? 999 : second) || a.localeCompare(b)
  })
}

function layoutMetrics(layers, layerLevels, width) {
  const leftGutter = 140
  const columnWidth = 198
  const layerGap = 24
  const layerLabels = []
  const layerStart = new Map()
  let currentX = leftGutter
  for (const layer of layers) {
    const levels = layerLevels.get(layer) ?? 1
    layerStart.set(layer, currentX)
    layerLabels.push({
      layer,
      x: currentX,
      width: levels * columnWidth,
      levels: Array.from({ length: levels }, (_, index) => ({
        label: `L${index + 1}`,
        x: currentX + index * columnWidth
      }))
    })
    currentX += levels * columnWidth + layerGap
  }
  return {
    leftGutter,
    columnWidth,
    layerGap,
    layerStart,
    layerLabels,
    contentWidth: Math.max(
      width,
      leftGutter + 40 + layers.reduce((sum, layer) => sum + (layerLevels.get(layer) ?? 1) * columnWidth + layerGap, 0)
    )
  }
}

function positionModule(context) {
  const moduleGroup = context.model.grouped.get(context.module)
  const levels = computeModuleLevelByNode(moduleGroup, context.model.layoutLayerByNode)
  const maxRows = moduleRowCount(moduleGroup, context.model.layers, context.model.layerLevels, levels)
  const bounds = moduleBounds(moduleGroup, context.model, context.metrics)
  const nodesTop = context.currentY + 44
  const bandHeight = 60 + maxRows * 76
  context.moduleLabels.push({
    module: context.module,
    x: bounds.min - 20,
    y: context.currentY,
    width: bounds.max - bounds.min + 40,
    height: bandHeight
  })
  positionModuleNodes(context, moduleGroup, levels, nodesTop)
  return context.currentY + bandHeight + 20
}

function moduleRowCount(moduleGroup, layers, layerLevels, levels) {
  return Math.max(
    1,
    ...layers.flatMap((layer) => {
      const items = moduleGroup.get(layer) ?? []
      return Array.from(
        { length: layerLevels.get(layer) ?? 1 },
        (_, level) => items.filter((node) => (levels.get(node.id) ?? 0) === level).length
      )
    })
  )
}

function moduleBounds(moduleGroup, model, metrics) {
  const used = model.layers.filter((layer) => (moduleGroup.get(layer) ?? []).length > 0)
  const min = used.length
    ? Math.min(...used.map((layer) => metrics.layerStart.get(layer) ?? metrics.leftGutter))
    : metrics.leftGutter
  const last = used.length ? used.at(-1) : model.layers.at(-1)
  const max =
    (metrics.layerStart.get(last) ?? metrics.leftGutter) + (model.layerLevels.get(last) ?? 1) * metrics.columnWidth
  return { min, max }
}

function positionModuleNodes(context, moduleGroup, levels, nodesTop) {
  for (const layer of context.model.layers) {
    const items = (moduleGroup.get(layer) ?? []).sort(
      (a, b) => nodeSortWeight(a) - nodeSortWeight(b) || a.label.localeCompare(b.label)
    )
    const rows = new Map()
    for (const node of items) {
      const level = levels.get(node.id) ?? 0
      const row = rows.get(level) ?? 0
      rows.set(level, row + 1)
      context.result.push({
        ...node,
        x: (context.metrics.layerStart.get(layer) ?? context.metrics.leftGutter) + level * context.metrics.columnWidth,
        y: nodesTop + row * 76,
        layoutLayer: layer,
        level,
        width: context.metrics.columnWidth - 20,
        height: nodeHeight(node, 'graph')
      })
    }
  }
}
