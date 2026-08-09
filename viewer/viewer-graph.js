import { createEdgeRendererRegistry, createLayoutRegistry, createNodeRendererRegistry } from './rendering-contracts.mjs'
import { layoutNodes, layoutSystemModules } from './viewer-layouts.js'
import { colors, DOMAIN_RENDER_LIMIT, els, NODE_RENDER_LIMIT, state } from './viewer-state.js'
import {
  applyTraceFocusLayout,
  buildModuleTraceContext,
  buildSystemModuleGraph,
  buildTraceContext
} from './viewer-trace.js'
import { escapeHtml, formatLayer, formatModule, formatType, truncate } from './viewer-utils.js'

const layoutRegistry = createLayoutRegistry([
  { id: 'system', layout: ({ nodes, width, height }) => layoutSystemModules(nodes, width, height) },
  { id: 'graph', layout: ({ nodes, width, height }) => layoutNodes(nodes, width, height) },
  { id: 'domain', layout: ({ nodes, width, height }) => layoutNodes(nodes, width, height) }
])
const nodeRendererRegistry = createNodeRendererRegistry([
  { id: 'system', render: ({ node }) => systemModuleNodeSvg(node) },
  {
    id: 'graph',
    render: ({ node, orphan, dimmed, focused }) => nodeGraphSvg(node, orphan, dimmed, focused)
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

function systemModuleEdgeSvg(edge, nodeById) {
  const from = nodeById.get(edge.from)
  const to = nodeById.get(edge.to)
  const x1 = from.x + from.width / 2
  const y1 = from.y + from.height / 2
  const x2 = to.x + to.width / 2
  const y2 = to.y + to.height / 2
  const curve = Math.max(28, Math.abs(x2 - x1) * 0.28)
  const thickness = Math.min(2.5, 0.7 + Math.log2(edge.count + 1) * 0.35)
  return `<path d="M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}" fill="none" stroke="#94a3b8" stroke-width="${thickness}" stroke-opacity="0.2" marker-end="url(#module-arrow)"><title>${escapeHtml(`${edge.count} relations · ${edge.relationTypes.join(', ')}`)}</title></path>`
}

function systemModuleNodeSvg(node) {
  const meta = node.meta
  const accent =
    meta.frontendCount && meta.backendCount
      ? '#2563eb'
      : meta.frontendCount
        ? '#0f766e'
        : meta.backendCount
          ? '#7c3aed'
          : '#64748b'
  const scope =
    meta.frontendCount && meta.backendCount
      ? 'Frontend + backend'
      : meta.frontendCount
        ? 'Frontend'
        : meta.backendCount
          ? 'Backend'
          : 'Shared support'
  return `
    <g class="node system-module-node" data-id="${escapeHtml(node.id)}" data-module="${escapeHtml(node.module)}" transform="translate(${node.x}, ${node.y})">
      <rect width="${node.width}" height="${node.height}" rx="6"></rect>
      <rect width="5" height="${node.height}" fill="${accent}" rx="5"></rect>
      <text x="14" y="22">${escapeHtml(truncate(node.label, 27))}</text>
      <text class="type" x="14" y="42">${escapeHtml(`${meta.nodeCount} components · ${meta.externalRelations} connections`)}</text>
      <text class="type" x="14" y="60">${escapeHtml(scope)}${meta.findingCount ? ` · ${meta.findingCount} findings` : ''}</text>
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
  const edges = state.graph.edges.filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to))
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
            focused: isFocusedNode(node, focusedIds)
          })
        )
        .join('')}
    </g>
  `
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

function graphModuleBandSvg(item, dimmed = false) {
  const bx = item.x
  const by = item.y
  const bw = item.width
  const bh = item.height
  const rawLabel = item.label ?? formatModule(item.module)
  const label = escapeHtml(rawLabel)
  const pillPad = 10
  const pillH = 20
  const pillY = by + (28 - pillH) / 2
  const pillW = rawLabel.length * 7 + pillPad * 2
  return `
    <g class="${dimmed ? 'trace-background' : ''}">
      <rect class="module-band" x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="6" ry="6"></rect>
      <rect class="module-header-band" x="${bx}" y="${by}" width="${bw}" height="28" rx="6" ry="6"></rect>
      <rect class="module-header-band-fill" x="${bx}" y="${by + 14}" width="${bw}" height="14"></rect>
      <rect class="module-pill" x="${bx + 10}" y="${pillY}" width="${pillW}" height="${pillH}" rx="4" ry="4"></rect>
      <text class="module-label" x="${bx + 10 + pillPad}" y="${pillY + 14}">${label}</text>
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

function edgeSvg(edge, nodeById, highlighted, dimmed = false, focused = false) {
  const from = nodeById.get(edge.from)
  const to = nodeById.get(edge.to)
  if (!from || !to) {
    return ''
  }
  if (state.view === 'domain') {
    return domainEdgeSvg(edge, from, to, highlighted, dimmed, focused)
  }

  const source = from.x <= to.x ? from : to
  const target = source === from ? to : from
  const x1 = source.x + source.width
  const y1 = source.y + source.height / 2
  const x2 = target.x
  const y2 = target.y + target.height / 2
  const mid = Math.max(x1 + 24, (x1 + x2) / 2)
  return `<path class="edge edge-type-${escapeHtml(edge.type)} confidence-${escapeHtml(edge.confidence ?? 'medium')} ${highlighted ? 'highlight' : ''} ${focused ? 'focused' : ''} ${dimmed ? 'dimmed' : ''}" d="M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}" marker-end="url(#arrow)" />`
}

function domainEdgeSvg(edge, from, to, highlighted, dimmed = false, focused = false) {
  const source = connectionPoint(from, to)
  const target = connectionPoint(to, from)
  const dx = target.x - source.x
  const dy = target.y - source.y
  const curve = Math.min(120, Math.max(36, Math.hypot(dx, dy) * 0.22))
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  const c1 = horizontal
    ? { x: source.x + Math.sign(dx || 1) * curve, y: source.y }
    : { x: source.x, y: source.y + Math.sign(dy || 1) * curve }
  const c2 = horizontal
    ? { x: target.x - Math.sign(dx || 1) * curve, y: target.y }
    : { x: target.x, y: target.y - Math.sign(dy || 1) * curve }

  return `<path class="edge domain-edge ${highlighted ? 'highlight' : ''} ${focused ? 'focused' : ''} ${dimmed ? 'dimmed' : ''}" d="M ${source.x} ${source.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${target.x} ${target.y}" marker-end="url(#arrow)" />`
}

function connectionPoint(node, other) {
  const cx = node.x + node.width / 2
  const cy = node.y + node.height / 2
  const ox = other.x + other.width / 2
  const oy = other.y + other.height / 2
  const dx = ox - cx
  const dy = oy - cy
  const useHorizontal = Math.abs(dx) / Math.max(node.width, 1) > Math.abs(dy) / Math.max(node.height, 1)

  if (useHorizontal) {
    return {
      x: dx >= 0 ? node.x + node.width : node.x,
      y: cy
    }
  }

  return {
    x: cx,
    y: dy >= 0 ? node.y + node.height : node.y
  }
}

function nodeGraphSvg(node, orphan, dimmed = false, focused = false) {
  const selected = node.id === state.selectedId
  const color = colors[node.type] || '#64748b'
  const quality = node.meta?.quality
  const coverage = node.meta?.coverage
  const review = node.meta?.review
  const metrics = quality
    ? `
    <rect class="metric-box" x="12" y="47" width="64" height="13" style="fill: ${scoreColor(quality.score)}" rx="3"></rect>
    <text class="metric-label" x="18" y="57">Q ${quality.score}/10</text>
  `
    : ''
  const testIndicator = coverage?.hasCoverage
    ? `
    <g class="test-indicator" transform="translate(${node.width - 43}, 8)" aria-label="Related test detected">
      <title>Related test detected</title>
      <rect width="35" height="16" rx="4"></rect>
      <text x="17.5" y="11.5" text-anchor="middle">TEST</text>
    </g>
  `
    : ''
  const reviewBadge = review
    ? `
    <g transform="translate(${node.width - 46}, 8)" aria-label="A revisar">
      <circle class="review-badge" cx="8" cy="8" r="8"></circle>
      <text class="review-label" x="5" y="12">!</text>
    </g>
  `
    : ''
  const support = state.trace && focused && (node.type === 'hook' || node.layer === 'auxiliary')
  const secondary =
    node.type === 'endpoint' && node.meta?.backend?.action
      ? node.meta.backend.action
      : `${formatType(node.type)} - ${formatModule(node.module)}`
  return `
    <g class="node ${selected ? 'selected' : ''} ${focused ? 'focused' : ''} ${support ? 'trace-support' : ''} ${orphan ? 'orphan' : ''} ${dimmed ? 'dimmed' : ''} ${node.layer === 'auxiliary' ? 'auxiliary' : ''}" data-id="${escapeHtml(node.id)}" transform="translate(${node.x}, ${node.y})">
      <rect width="${node.width}" height="${node.height}"></rect>
      <rect width="5" height="${node.height}" fill="${color}" rx="5"></rect>
      <text x="12" y="20">${escapeHtml(truncate(node.label, 24))}</text>
      <text class="type" x="12" y="38">${escapeHtml(truncate(secondary, 30))}</text>
      ${metrics}
      ${reviewBadge}
      ${testIndicator}
    </g>
  `
}

function nodeDomainSvg(node, orphan, dimmed = false, focused = false) {
  if (node.type === 'entity') {
    return umlEntitySvg(node, orphan, dimmed, focused)
  }
  return nodeGraphSvg(node, orphan, dimmed, focused)
}

function umlEntitySvg(node, orphan, dimmed = false, focused = false) {
  const selected = node.id === state.selectedId
  const properties = node.meta?.domain?.properties ?? []
  const visibleProperties = properties.slice(0, 10)
  const remainingCount = Math.max(0, properties.length - visibleProperties.length)
  const rows = visibleProperties
    .map(
      (property, index) => `
    <text class="uml-property" x="12" y="${58 + index * 16}">
      ${escapeHtml(truncate(`${property.name}: ${property.type}`, 34))}
    </text>
  `
    )
    .join('')
  const more =
    remainingCount > 0
      ? `<text class="uml-property muted" x="12" y="${58 + visibleProperties.length * 16}">+ ${remainingCount} more</text>`
      : ''

  return `
    <g class="node uml-entity ${selected ? 'selected' : ''} ${focused ? 'focused' : ''} ${orphan ? 'orphan' : ''} ${dimmed ? 'dimmed' : ''}" data-id="${escapeHtml(node.id)}" transform="translate(${node.x}, ${node.y})">
      <rect width="${node.width}" height="${node.height}"></rect>
      <rect class="uml-header" width="${node.width}" height="36"></rect>
      <text class="uml-title" x="12" y="22">${escapeHtml(truncate(node.label, 30))}</text>
      <line class="uml-divider" x1="0" y1="36" x2="${node.width}" y2="36"></line>
      ${rows}
      ${more}
    </g>
  `
}

function scoreColor(score) {
  const hue = ((Math.max(1, Math.min(10, score)) - 1) / 9) * 120
  return `hsl(${hue}, 72%, 42%)`
}

export { nodesForRender, render, renderingStrategies, scoreColor }
