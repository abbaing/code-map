import { edgeRendererRegistry, nodeRendererRegistry } from '#viewer/viewer-rendering-strategies.js'
import { state } from '#viewer/viewer-state.js'
import { arrowDefinition } from '#viewer/viewer-svg-edges.js'
import { escapeHtml, formatModule } from '#viewer/viewer-utils.js'
import {
  connectedEdgeIds,
  focusedNodeIds,
  isDimmedEdge,
  isDimmedNode,
  isFocusedEdge,
  isFocusedNode
} from '#viewer/viewer-render-focus.js'

export function renderDomainView(svg, layout) {
  const nodes = layout.nodes
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const visibleIds = new Set(nodeById.keys())
  const orphanIds = new Set(state.graph.orphans.map((orphan) => orphan.id))
  const selectedEdges = connectedEdgeIds(state.selectedId)
  const edges = state.graph.edges.filter(
    (edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to) && edge.type === 'domain-relation'
  )
  const focusedIds = focusedNodeIds(state.selectedId, edges)
  svg.innerHTML = `
    ${arrowDefinition()}
    ${renderClusterBands(layout)}
    <g class="edges">${renderEdges(edges, nodeById, selectedEdges, focusedIds)}</g>
    <g class="nodes">${renderNodes(nodes, orphanIds, focusedIds)}</g>
  `
}

function renderClusterBands(layout) {
  return layout.moduleLabels
    .map(
      (item) => `
      <rect class="domain-cluster-band" x="${item.x ?? 0}" y="${item.y}" width="${item.width ?? layout.width}" height="${item.height}"></rect>
      <text class="domain-cluster-label" x="${item.labelX ?? 12}" y="${item.y + 18}">${escapeHtml(item.label ?? formatModule(item.module))}</text>
    `
    )
    .join('')
}

function renderEdges(edges, nodeById, selectedEdges, focusedIds) {
  return edges
    .map((edge) =>
      edgeRendererRegistry.render('domain', {
        edge,
        nodeById,
        highlighted: selectedEdges.has(edge.id),
        dimmed: isDimmedEdge(edge, focusedIds),
        focused: isFocusedEdge(edge, focusedIds)
      })
    )
    .join('')
}

function renderNodes(nodes, orphanIds, focusedIds) {
  return nodes
    .map((node) =>
      nodeRendererRegistry.render('domain', {
        node,
        orphan: orphanIds.has(node.id),
        dimmed: isDimmedNode(node, focusedIds),
        focused: isFocusedNode(node, focusedIds)
      })
    )
    .join('')
}
