import { edgeRendererRegistry, nodeRendererRegistry } from '#viewer/viewer-rendering-strategies.js'
import { state } from '#viewer/viewer-state.js'
import { graphModuleBandSvg } from '#viewer/viewer-svg.js'
import { arrowDefinition } from '#viewer/viewer-svg-edges.js'
import { isDataContextCatalogEdge } from '#viewer/viewer-trace.js'
import { escapeHtml, formatLayer } from '#viewer/viewer-utils.js'
import {
  connectedEdgeIds,
  focusedNodeIds,
  isDimmedEdge,
  isDimmedNode,
  isFocusedEdge,
  isFocusedNode
} from '#viewer/viewer-render-focus.js'

export function renderGraphView(svg, layout) {
  const context = graphRenderContext(layout.nodes)
  svg.innerHTML = `
    ${arrowDefinition()}
    ${layout.moduleLabels.map((item) => graphModuleBandSvg(item, Boolean(state.trace))).join('')}
    ${traceBoundary(layout)}
    ${layerLabels(layout.layerLabels)}
    <g class="edges">${renderEdges(context)}</g>
    <g class="nodes">${renderNodes(context)}</g>
  `
}

export function graphEdgesForRender(edges, visibleIds, nodeById) {
  return edges.filter(
    (edge) => !isDataContextCatalogEdge(edge, nodeById) && visibleIds.has(edge.from) && visibleIds.has(edge.to)
  )
}

export function managedEntityCounts(edges) {
  const counts = new Map()
  for (const edge of edges) {
    if (edge.type === 'dbset') {
      counts.set(edge.from, (counts.get(edge.from) ?? 0) + 1)
    }
  }
  return counts
}

function graphRenderContext(nodes) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const moduleOverview = Boolean(state.trace?.moduleOverview)
  const edges = graphEdgesForRender(state.graph.edges, new Set(nodeById.keys()), nodeById)
  return {
    nodes,
    nodeById,
    edges,
    orphanIds: new Set(state.graph.orphans.map((orphan) => orphan.id)),
    selectedEdges: moduleOverview ? new Set() : (state.trace?.edgeIds ?? connectedEdgeIds(state.selectedId)),
    managedEntities: managedEntityCounts(state.graph.edges),
    focusedIds: moduleOverview ? null : (state.trace?.nodeIds ?? focusedNodeIds(state.selectedId, edges))
  }
}

function renderEdges(context) {
  return context.edges
    .map((edge) =>
      edgeRendererRegistry.render('graph', {
        edge,
        nodeById: context.nodeById,
        highlighted: context.selectedEdges.has(edge.id),
        dimmed: isDimmedEdge(edge, context.focusedIds),
        focused: isFocusedEdge(edge, context.focusedIds)
      })
    )
    .join('')
}

function renderNodes(context) {
  return context.nodes
    .map((node) =>
      nodeRendererRegistry.render('graph', {
        node,
        orphan: context.orphanIds.has(node.id),
        dimmed: isDimmedNode(node, context.focusedIds),
        focused: isFocusedNode(node, context.focusedIds),
        managedEntityCount: context.managedEntities.get(node.id) ?? 0
      })
    )
    .join('')
}

function traceBoundary(layout) {
  if (!layout.traceBoundaryX) {
    return ''
  }
  return `<line class="trace-boundary" x1="${layout.traceBoundaryX}" y1="34" x2="${layout.traceBoundaryX}" y2="${layout.traceHeight - 18}"></line>
      <text class="trace-boundary-label" x="${layout.traceBoundaryX + 9}" y="51">BACKEND STARTS</text>`
}

function layerLabels(items) {
  return items
    .map(
      (item) => `
      <text class="lane-label" x="${item.x + (item.width ?? 0) / 2}" y="20">${escapeHtml(item.label ?? formatLayer(item.layer))}</text>
    `
    )
    .join('')
}
