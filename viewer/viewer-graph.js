import {
  createEdgeRendererRegistry,
  createLayoutRegistry,
  createNodeRendererRegistry
} from '#viewer/rendering-contracts.mjs'
import { layoutNodes, layoutSystemModules } from '#viewer/viewer-layouts.js'
import { DOMAIN_RENDER_LIMIT, els, NODE_RENDER_LIMIT, state } from '#viewer/viewer-state.js'
import {
  edgeSvg,
  graphModuleBandSvg,
  nodeDomainSvg,
  nodeGraphSvg,
  systemModuleEdgeSvg,
  systemModuleNodeSvg
} from '#viewer/viewer-svg.js'
import {
  applyTraceFocusLayout,
  buildModuleTraceContext,
  buildSystemModuleGraph,
  buildTraceContext,
  isDataContextCatalogEdge
} from '#viewer/viewer-trace.js'
import { escapeHtml, formatLayer, formatModule } from '#viewer/viewer-utils.js'

const layoutRegistry = createLayoutRegistry([
  { id: 'system', layout: ({ nodes, width, height }) => layoutSystemModules(nodes, width, height) },
  { id: 'graph', layout: ({ nodes, width, height }) => layoutNodes(nodes, width, height) },
  { id: 'domain', layout: ({ nodes, width, height }) => layoutNodes(nodes, width, height) }
])
const nodeRendererRegistry = createNodeRendererRegistry([
  { id: 'system', render: ({ node }) => systemModuleNodeSvg(node) },
  {
    id: 'graph',
    render: ({ node, orphan, dimmed, focused, managedEntityCount }) =>
      nodeGraphSvg(node, orphan, dimmed, focused, managedEntityCount)
  },
  {
    id: 'domain',
    render: ({ node, orphan, dimmed, focused }) => nodeDomainSvg(node, orphan, dimmed, focused)
  }
])
const edgeRendererRegistry = createEdgeRendererRegistry([
  { id: 'system', render: ({ edge, nodeById }) => systemModuleEdgeSvg(edge, nodeById) },
  {
    id: 'graph',
    render: ({ edge, nodeById, highlighted, dimmed, focused }) => edgeSvg(edge, nodeById, highlighted, dimmed, focused)
  },
  {
    id: 'domain',
    render: ({ edge, nodeById, highlighted, dimmed, focused }) => edgeSvg(edge, nodeById, highlighted, dimmed, focused)
  }
])

const renderingStrategies = Object.freeze({
  layouts: layoutRegistry.ids,
  nodes: nodeRendererRegistry.ids,
  edges: edgeRendererRegistry.ids
})

function render() {
  const svg = els.graph
  const vw = svg.parentElement.clientWidth || 900
  const vh = svg.parentElement.clientHeight || 700
  const width = Math.max(vw, 900)
  const height = Math.max(vh, 700)

  if (state.view === 'graph' && !state.activeModule && !state.selectedId) {
    renderSystemModuleGraph(svg, width, height, vw, vh)
    return
  }

  const renderLimit = state.view === 'domain' ? DOMAIN_RENDER_LIMIT : NODE_RENDER_LIMIT
  state.trace =
    state.view === 'graph'
      ? state.selectedId
        ? buildTraceContext(state.graph, state.selectedId, state.showAllTrace)
        : buildModuleTraceContext(state.graph, state.activeModule)
      : null
  const nodesToRender = nodesForRender(state.filteredNodes, renderLimit, state.trace)
  const renderedIds = new Set(nodesToRender.map((node) => node.id))
  const truncated = state.filteredNodes.some((node) => !renderedIds.has(node.id))

  if (truncated) {
    els.nodeLimitBanner.textContent = `Showing ${renderLimit} of ${state.filteredNodes.length} nodes. Use filters or drill into a module to see fewer.`
    els.nodeLimitBanner.classList.remove('hidden')
  } else {
    els.nodeLimitBanner.classList.add('hidden')
  }

  let layout = layoutRegistry.layout(state.view, { nodes: nodesToRender, width, height })
  if (state.trace) {
    layout = applyTraceFocusLayout(layout, state.trace, width, height, state.view)
  }

  if (state.fitView) {
    const viewport = fitLayoutViewport(layout, vw, vh)
    state.zoom = viewport.zoom
    state.panX = viewport.panX
    state.panY = viewport.panY
    state.fitView = false
  }

  svg.style.width = '100%'
  svg.style.height = '100%'
  const vpW = vw / state.zoom
  const vpH = vh / state.zoom
  svg.setAttribute('viewBox', `${state.panX} ${state.panY} ${vpW} ${vpH}`)
  els.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`

  if (state.view === 'domain') {
    renderDomainView(svg, layout)
  } else {
    renderGraphView(svg, layout)
  }
}

function fitLayoutViewport(layout, viewportWidth, viewportHeight, padding = 40) {
  if (!layout.nodes.length) {
    return { zoom: 1, panX: 0, panY: 0 }
  }

  const horizontalItems = [...layout.nodes, ...(layout.moduleLabels ?? []), ...(layout.layerLabels ?? [])]
  const verticalItems = [...layout.nodes, ...(layout.moduleLabels ?? [])]
  const minX = Math.min(...horizontalItems.map((item) => item.x ?? 0))
  const maxX = Math.max(...horizontalItems.map((item) => (item.x ?? 0) + (item.width ?? 0)))
  const minY = Math.min(0, ...verticalItems.map((item) => item.y ?? 0))
  const maxY = Math.max(...verticalItems.map((item) => (item.y ?? 0) + (item.height ?? 0)))
  const contentWidth = Math.max(1, maxX - minX + padding * 2)
  const contentHeight = Math.max(1, maxY - minY + padding * 2)
  const zoom = Math.min(
    1,
    Math.max(0.2, Number(Math.min(viewportWidth / contentWidth, viewportHeight / contentHeight).toFixed(2)))
  )
  const visibleWidth = viewportWidth / zoom
  const visibleHeight = viewportHeight / zoom

  return {
    zoom,
    panX: (minX + maxX - visibleWidth) / 2,
    panY: (minY + maxY - visibleHeight) / 2
  }
}

function renderSystemModuleGraph(svg, width, height, viewportWidth, viewportHeight) {
  const systemGraph = buildSystemModuleGraph(state.graph, state.filteredNodes, formatModule)
  const layout = layoutRegistry.layout('system', { nodes: systemGraph.nodes, width, height })
  const nodeById = new Map(layout.nodes.map((node) => [node.id, node]))
  const visibleEdges = systemGraph.edges.filter((edge) => nodeById.has(edge.from) && nodeById.has(edge.to))
  els.nodeLimitBanner.textContent = `System map · ${layout.nodes.length} modules · ${visibleEdges.length} module flows · Select a module for complete paths.`
  els.nodeLimitBanner.classList.remove('hidden')
  svg.style.width = '100%'
  svg.style.height = '100%'
  svg.setAttribute(
    'viewBox',
    `${state.panX} ${state.panY} ${viewportWidth / state.zoom} ${viewportHeight / state.zoom}`
  )
  els.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`
  svg.innerHTML = `
    <defs>
      <marker id="module-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
        <path d="M0,0 L0,6 L7,3 z" fill="#94a3b8"></path>
      </marker>
    </defs>
    <g class="module-overview-edges">
      ${visibleEdges.map((edge) => edgeRendererRegistry.render('system', { edge, nodeById })).join('')}
    </g>
    <g class="module-overview-nodes">
      ${layout.nodes.map((node) => nodeRendererRegistry.render('system', { node })).join('')}
    </g>
  `
}

function nodesForRender(filteredNodes, renderLimit, trace) {
  const nodes = filteredNodes.slice(0, renderLimit)
  if (!trace) {
    return nodes
  }
  const included = new Set(nodes.map((node) => node.id))
  const nodeById = new Map(state.graph.nodes.map((node) => [node.id, node]))
  for (const id of trace.nodeIds) {
    if (included.has(id)) {
      continue
    }
    const node = nodeById.get(id)
    if (node) {
      nodes.push(node)
    }
  }
  return nodes
}

function renderGraphView(svg, layout) {
  const nodes = layout.nodes
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const visibleIds = new Set(nodes.map((node) => node.id))
  const orphanIds = new Set(state.graph.orphans.map((orphan) => orphan.id))
  const moduleOverview = Boolean(state.trace?.moduleOverview)
  const selectedEdges = moduleOverview ? new Set() : (state.trace?.edgeIds ?? connectedEdgeIds(state.selectedId))
  const edges = graphEdgesForRender(state.graph.edges, visibleIds, nodeById)
  const managedEntities = managedEntityCounts(state.graph.edges)
  const focusedIds = moduleOverview ? null : (state.trace?.nodeIds ?? focusedNodeIds(state.selectedId, edges))

  svg.innerHTML = `
    <defs>
      <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
        <path d="M0,0 L0,6 L7,3 z" fill="#9aa4b2"></path>
      </marker>
    </defs>
    ${layout.moduleLabels.map((item) => graphModuleBandSvg(item, Boolean(state.trace))).join('')}
    ${
      layout.traceBoundaryX
        ? `<line class="trace-boundary" x1="${layout.traceBoundaryX}" y1="34" x2="${layout.traceBoundaryX}" y2="${layout.traceHeight - 18}"></line>
      <text class="trace-boundary-label" x="${layout.traceBoundaryX + 9}" y="51">BACKEND STARTS</text>`
        : ''
    }
    ${layout.layerLabels
      .map(
        (item) => `
      <text class="lane-label" x="${item.x + (item.width ?? 0) / 2}" y="20">${escapeHtml(item.label ?? formatLayer(item.layer))}</text>
    `
      )
      .join('')}
    <g class="edges">
      ${edges
        .map((edge) =>
          edgeRendererRegistry.render('graph', {
            edge,
            nodeById,
            highlighted: selectedEdges.has(edge.id),
            dimmed: isDimmedEdge(edge, focusedIds),
            focused: isFocusedEdge(edge, focusedIds)
          })
        )
        .join('')}
    </g>
    <g class="nodes">
      ${nodes
        .map((node) =>
          nodeRendererRegistry.render('graph', {
            node,
            orphan: orphanIds.has(node.id),
            dimmed: isDimmedNode(node, focusedIds),
            focused: isFocusedNode(node, focusedIds),
            managedEntityCount: managedEntities.get(node.id) ?? 0
          })
        )
        .join('')}
    </g>
  `
}

function graphEdgesForRender(edges, visibleIds, nodeById) {
  return edges.filter(
    (edge) => !isDataContextCatalogEdge(edge, nodeById) && visibleIds.has(edge.from) && visibleIds.has(edge.to)
  )
}

function managedEntityCounts(edges) {
  const counts = new Map()
  for (const edge of edges) {
    if (edge.type === 'dbset') {
      counts.set(edge.from, (counts.get(edge.from) ?? 0) + 1)
    }
  }
  return counts
}

function renderDomainView(svg, layout) {
  const nodes = layout.nodes
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const visibleIds = new Set(nodes.map((node) => node.id))
  const orphanIds = new Set(state.graph.orphans.map((orphan) => orphan.id))
  const selectedEdges = connectedEdgeIds(state.selectedId)
  const edges = state.graph.edges.filter(
    (edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to) && edge.type === 'domain-relation'
  )
  const focusedIds = focusedNodeIds(state.selectedId, edges)

  svg.innerHTML = `
    <defs>
      <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
        <path d="M0,0 L0,6 L7,3 z" fill="#9aa4b2"></path>
      </marker>
    </defs>
    ${layout.moduleLabels
      .map(
        (item) => `
      <rect class="domain-cluster-band" x="${item.x ?? 0}" y="${item.y}" width="${item.width ?? layout.width}" height="${item.height}"></rect>
      <text class="domain-cluster-label" x="${item.labelX ?? 12}" y="${item.y + 18}">${escapeHtml(item.label ?? formatModule(item.module))}</text>
    `
      )
      .join('')}
    <g class="edges">
      ${edges
        .map((edge) =>
          edgeRendererRegistry.render('domain', {
            edge,
            nodeById,
            highlighted: selectedEdges.has(edge.id),
            dimmed: isDimmedEdge(edge, focusedIds),
            focused: isFocusedEdge(edge, focusedIds)
          })
        )
        .join('')}
    </g>
    <g class="nodes">
      ${nodes
        .map((node) =>
          nodeRendererRegistry.render('domain', {
            node,
            orphan: orphanIds.has(node.id),
            dimmed: isDimmedNode(node, focusedIds),
            focused: isFocusedNode(node, focusedIds)
          })
        )
        .join('')}
    </g>
  `
}

function focusedNodeIds(selectedId, edges) {
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

function connectedEdgeIds(nodeId) {
  if (!nodeId) {
    return new Set()
  }
  return new Set(state.graph.edges.filter((edge) => edge.from === nodeId || edge.to === nodeId).map((edge) => edge.id))
}

function isDimmedNode(node, focusedIds) {
  return Boolean(focusedIds && !focusedIds.has(node.id))
}

function isDimmedEdge(edge, focusedIds) {
  return Boolean(focusedIds && (!focusedIds.has(edge.from) || !focusedIds.has(edge.to)))
}

function isFocusedNode(node, focusedIds) {
  return Boolean(focusedIds?.has(node.id))
}

function isFocusedEdge(edge, focusedIds) {
  return Boolean(focusedIds?.has(edge.from) && focusedIds?.has(edge.to))
}

export { fitLayoutViewport, graphEdgesForRender, managedEntityCounts, nodesForRender, render, renderingStrategies }
