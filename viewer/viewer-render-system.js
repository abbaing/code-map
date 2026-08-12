import { edgeRendererRegistry, layoutRegistry, nodeRendererRegistry } from '#viewer/viewer-rendering-strategies.js'
import { els, state } from '#viewer/viewer-state.js'
import { buildSystemModuleGraph } from '#viewer/viewer-trace.js'
import { formatModule } from '#viewer/viewer-utils.js'

export function renderSystemModuleGraph(svg, dimensions) {
  const systemGraph = buildSystemModuleGraph(state.graph, state.filteredNodes, formatModule)
  const layout = layoutRegistry.layout('system', {
    nodes: systemGraph.nodes,
    width: dimensions.width,
    height: dimensions.height
  })
  const nodeById = new Map(layout.nodes.map((node) => [node.id, node]))
  const visibleEdges = systemGraph.edges.filter((edge) => nodeById.has(edge.from) && nodeById.has(edge.to))
  els.nodeLimitBanner.textContent = `System map Â· ${layout.nodes.length} modules Â· ${visibleEdges.length} module flows Â· Select a module for complete paths.`
  els.nodeLimitBanner.classList.remove('hidden')
  svg.style.width = '100%'
  svg.style.height = '100%'
  svg.setAttribute(
    'viewBox',
    `${state.panX} ${state.panY} ${dimensions.viewportWidth / state.zoom} ${dimensions.viewportHeight / state.zoom}`
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
