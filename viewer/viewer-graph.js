import { renderDomainView } from '#viewer/viewer-render-domain.js'
import { graphEdgesForRender, managedEntityCounts, renderGraphView } from '#viewer/viewer-render-graph.js'
import { renderSystemModuleGraph } from '#viewer/viewer-render-system.js'
import { layoutRegistry, renderingStrategies } from '#viewer/viewer-rendering-strategies.js'
import { DOMAIN_RENDER_LIMIT, els, NODE_RENDER_LIMIT, state } from '#viewer/viewer-state.js'
import { applyTraceFocusLayout, buildModuleTraceContext, buildTraceContext } from '#viewer/viewer-trace.js'

export function render() {
  const svg = els.graph
  const dimensions = viewDimensions(svg)
  if (state.view === 'graph' && !state.activeSubmap && !state.activeModule && !state.selectedId) {
    renderSystemModuleGraph(svg, dimensions)
    return
  }
  const trace = resolveLayoutTrace()
  const renderLimit = state.view === 'domain' ? DOMAIN_RENDER_LIMIT : NODE_RENDER_LIMIT
  const nodes = nodesForRender(state.filteredNodes, renderLimit, trace)
  updateLimitBanner(nodes, renderLimit)
  let layout = layoutRegistry.layout(state.view, { nodes, width: dimensions.width, height: dimensions.height })
  if (trace) {
    layout = applyTraceFocusLayout(layout, trace, dimensions.width, dimensions.height, state.view)
  }
  applyViewport(svg, layout, dimensions)
  if (state.view === 'domain') {
    renderDomainView(svg, layout)
  } else {
    renderGraphView(svg, layout)
  }
}

export function fitLayoutViewport(layout, viewportWidth, viewportHeight, padding = 40) {
  if (!layout.nodes.length) {
    return { zoom: 1, panX: 0, panY: 0 }
  }
  const horizontal = [...layout.nodes, ...(layout.moduleLabels ?? []), ...(layout.layerLabels ?? [])]
  const vertical = [...layout.nodes, ...(layout.moduleLabels ?? [])]
  const minX = Math.min(...horizontal.map((item) => item.x ?? 0))
  const maxX = Math.max(...horizontal.map((item) => (item.x ?? 0) + (item.width ?? 0)))
  const minY = Math.min(0, ...vertical.map((item) => item.y ?? 0))
  const maxY = Math.max(...vertical.map((item) => (item.y ?? 0) + (item.height ?? 0)))
  const contentWidth = Math.max(1, maxX - minX + padding * 2)
  const contentHeight = Math.max(1, maxY - minY + padding * 2)
  const ratio = Math.min(viewportWidth / contentWidth, viewportHeight / contentHeight)
  const zoom = Math.min(1, Math.max(0.2, Number(ratio.toFixed(2))))
  return {
    zoom,
    panX: (minX + maxX - viewportWidth / zoom) / 2,
    panY: (minY + maxY - viewportHeight / zoom) / 2
  }
}

export function nodesForRender(filteredNodes, renderLimit, trace) {
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

function resolveLayoutTrace() {
  const moduleTrace =
    state.view === 'graph' && state.activeModule ? buildModuleTraceContext(state.graph, state.activeModule) : null
  state.trace =
    state.view === 'graph'
      ? state.selectedId
        ? buildTraceContext(state.graph, state.selectedId, state.showAllTrace)
        : moduleTrace
      : null
  return moduleTrace ?? state.trace
}

function updateLimitBanner(nodes, renderLimit) {
  const ids = new Set(nodes.map((node) => node.id))
  const truncated = state.filteredNodes.some((node) => !ids.has(node.id))
  if (truncated) {
    els.nodeLimitBanner.textContent = `Showing ${renderLimit} of ${state.filteredNodes.length} nodes. Use filters or drill into a module to see fewer.`
    els.nodeLimitBanner.classList.remove('hidden')
  } else {
    els.nodeLimitBanner.classList.add('hidden')
  }
}

function viewDimensions(svg) {
  const viewportWidth = svg.parentElement.clientWidth || 900
  const viewportHeight = svg.parentElement.clientHeight || 700
  return {
    viewportWidth,
    viewportHeight,
    width: Math.max(viewportWidth, 900),
    height: Math.max(viewportHeight, 700)
  }
}

function applyViewport(svg, layout, dimensions) {
  if (state.fitView) {
    const viewport = fitLayoutViewport(layout, dimensions.viewportWidth, dimensions.viewportHeight)
    Object.assign(state, { ...viewport, fitView: false })
  }
  svg.style.width = '100%'
  svg.style.height = '100%'
  svg.setAttribute(
    'viewBox',
    `${state.panX} ${state.panY} ${dimensions.viewportWidth / state.zoom} ${dimensions.viewportHeight / state.zoom}`
  )
  els.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`
}

export { graphEdgesForRender, managedEntityCounts, renderingStrategies }
