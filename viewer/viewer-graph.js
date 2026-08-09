import { createEdgeRendererRegistry, createLayoutRegistry, createNodeRendererRegistry } from './rendering-contracts.mjs'
import { colors, DOMAIN_RENDER_LIMIT, els, layerOrder, NODE_RENDER_LIMIT, state } from './viewer-state.js'
import {
  applyTraceFocusLayout,
  buildModuleTraceContext,
  buildSystemModuleGraph,
  buildTraceContext,
  nodeHeight
} from './viewer-trace.js'
import { escapeHtml, formatLayer, formatModule, formatType, truncate, unique } from './viewer-utils.js'

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

function layoutSystemModules(nodes, width, height) {
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

function layoutNodes(nodes, width, height) {
  const connectedLayerByNode = inferAuxiliaryLayers(nodes)
  const domainOrder = state.view === 'domain' ? computeDomainOrder(nodes) : new Map()
  if (state.view === 'domain') {
    return layoutDomainNodes(nodes, width, height, domainOrder)
  }
  const grouped = new Map()
  const layoutLayerByNode = new Map()
  for (const node of nodes) {
    const module = state.view === 'domain' ? domainEntityModule(node) : node.module || 'shared'
    const layer =
      node.layer === 'auxiliary' ? (connectedLayerByNode.get(node.id) ?? 'ui-component-logic') : node.layer || 'unknown'
    layoutLayerByNode.set(node.id, layer)
    if (!grouped.has(module)) {
      grouped.set(module, new Map())
    }
    const moduleGroup = grouped.get(module)
    if (!moduleGroup.has(layer)) {
      moduleGroup.set(layer, [])
    }
    moduleGroup.get(layer).push(node)
  }

  const layers = unique(
    nodes.map((node) =>
      node.layer === 'auxiliary' ? (connectedLayerByNode.get(node.id) ?? 'ui-component-logic') : node.layer || 'unknown'
    )
  ).sort((a, b) => {
    const ia = layerOrder.indexOf(a)
    const ib = layerOrder.indexOf(b)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b)
  })
  const modules = [...grouped.keys()].sort((a, b) => moduleWeight(a) - moduleWeight(b) || a.localeCompare(b))

  const leftGutter = 140
  const topGutter = 54
  const columnWidth = state.view === 'domain' ? 260 : 198
  const layerGap = 24
  const levelGap = 10
  const rowHeight = 76
  const layerLevels = computeLayerLevels(nodes, layers, layoutLayerByNode)
  const layerColumns = layers.map((layer) => ({
    layer,
    levels: layerLevels.get(layer) ?? 1
  }))
  const contentWidth = Math.max(
    width,
    leftGutter + 40 + layerColumns.reduce((sum, item) => sum + item.levels * columnWidth + layerGap, 0)
  )
  const result = []
  const moduleLabels = []
  const layerLabelItems = []
  const layerStart = new Map()
  let currentX = leftGutter
  for (const item of layerColumns) {
    layerStart.set(item.layer, currentX)
    layerLabelItems.push({
      layer: item.layer,
      x: currentX,
      width: item.levels * columnWidth,
      levels: Array.from({ length: item.levels }, (_, index) => ({
        label: `L${index + 1}`,
        x: currentX + index * columnWidth
      }))
    })
    currentX += item.levels * columnWidth + layerGap
  }
  let currentY = topGutter

  const headerH = 28
  const padX = 20
  const padY = 16
  const moduleGap = 20

  modules.forEach((module) => {
    const moduleGroup = grouped.get(module)
    const levelByNode = computeModuleLevelByNode(moduleGroup, layoutLayerByNode)
    const maxRows = Math.max(
      1,
      ...layers.flatMap((layer) => {
        const items = moduleGroup.get(layer) ?? []
        const levels = layerLevels.get(layer) ?? 1
        return Array.from(
          { length: levels },
          (_, level) => items.filter((node) => (levelByNode.get(node.id) ?? 0) === level).length
        )
      })
    )

    // x extents from the layers this module actually uses
    const usedLayers = layers.filter((layer) => (moduleGroup.get(layer) ?? []).length > 0)
    const xMin =
      usedLayers.length > 0 ? Math.min(...usedLayers.map((layer) => layerStart.get(layer) ?? leftGutter)) : leftGutter
    const lastLayer = usedLayers.length > 0 ? usedLayers[usedLayers.length - 1] : layers[layers.length - 1]
    const lastLevels = layerLevels.get(lastLayer) ?? 1
    const xMax = (layerStart.get(lastLayer) ?? leftGutter) + lastLevels * columnWidth

    const nodesTop = currentY + headerH + padY
    const bandHeight = headerH + padY + maxRows * rowHeight + padY

    moduleLabels.push({
      module,
      x: xMin - padX,
      y: currentY,
      width: xMax - xMin + padX * 2,
      height: bandHeight
    })

    layers.forEach((layer) => {
      const items = (moduleGroup.get(layer) ?? []).sort((a, b) => compareNodes(a, b, domainOrder))
      const rowsByLevel = new Map()
      items.forEach((node) => {
        const level = levelByNode.get(node.id) ?? 0
        const rowIndex = rowsByLevel.get(level) ?? 0
        rowsByLevel.set(level, rowIndex + 1)
        const x = (layerStart.get(layer) ?? leftGutter) + level * columnWidth
        result.push({
          ...node,
          x,
          y: nodesTop + rowIndex * rowHeight,
          layoutLayer: layer,
          level,
          width: columnWidth - levelGap * 2,
          height: nodeHeight(node, state.view)
        })
      })
    })

    currentY += bandHeight + moduleGap
  })

  const neededHeight = Math.max(height, currentY + 40)
  return { nodes: result, width: contentWidth, height: neededHeight, layerLabels: layerLabelItems, moduleLabels }
}

function layoutDomainNodes(nodes, width, height, domainOrder) {
  const clusters = buildDomainClusters(nodes, domainOrder)
  const leftGutter = 140
  const topGutter = 54
  const cardWidth = 260
  const columnGap = 80
  const rowGap = 80
  const clusterGap = 90
  const targetWidth = Math.max(width, 4200)
  const result = []
  const moduleLabels = []
  let cursorX = leftGutter
  let cursorY = topGutter
  let rowBottom = topGutter
  let contentRight = leftGutter

  for (const cluster of clusters) {
    const placement =
      cluster.degree > 0
        ? forcePlaceDomainCluster(cluster, cardWidth)
        : gridPlaceDomainCluster(cluster, cardWidth, columnGap, rowGap)
    const clusterWidth = placement.width + 32
    const clusterHeight = placement.height + 70

    if (cursorX > leftGutter && cursorX + clusterWidth > targetWidth) {
      cursorX = leftGutter
      cursorY = rowBottom + clusterGap
    }

    moduleLabels.push({
      module: cluster.key,
      label: cluster.label,
      x: cursorX,
      width: clusterWidth,
      labelX: cursorX + 16,
      y: cursorY + 18,
      height: clusterHeight
    })

    cluster.nodes.forEach((node) => {
      const position = placement.positions.get(node.id)
      result.push({
        ...node,
        x: cursorX + 16 + position.x,
        y: cursorY + 48 + position.y,
        layoutLayer: 'domain',
        level: 0,
        width: cardWidth,
        height: nodeHeight(node, state.view)
      })
    })

    contentRight = Math.max(contentRight, cursorX + clusterWidth)
    rowBottom = Math.max(rowBottom, cursorY + clusterHeight)
    cursorX += clusterWidth + clusterGap
  }

  return {
    nodes: result,
    width: Math.max(width, contentRight + 40),
    height: Math.max(height, rowBottom + 50),
    layerLabels: [
      { layer: 'domain', x: leftGutter, width: Math.max(width, contentRight + 40) - leftGutter, levels: [] }
    ],
    moduleLabels
  }
}

function gridPlaceDomainCluster(cluster, cardWidth, columnGap, rowGap) {
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
    const column = index % columns
    positions.set(node.id, {
      x: column * (cardWidth + columnGap),
      y: rowOffsets[row]
    })
  })

  return {
    positions,
    width: columns * cardWidth + Math.max(0, columns - 1) * columnGap,
    height: rowHeights.reduce((sum, value) => sum + value, 0) + Math.max(0, rows - 1) * rowGap
  }
}

function forcePlaceDomainCluster(cluster, cardWidth) {
  const nodes = orderDomainClusterForEdges(cluster.nodes)
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const edges = state.graph.edges.filter(
    (edge) => edge.type === 'domain-relation' && byId.has(edge.from) && byId.has(edge.to)
  )
  const positions = new Map()
  const velocities = new Map()
  const anchors = new Map()
  const radius = Math.max(260, Math.sqrt(nodes.length) * 165)
  const center = radius + 260

  nodes.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(nodes.length, 1)
    const ring = radius * (0.9 + seededUnit(`${node.id}:ring`) * 0.14)
    const anchor = {
      x: center + Math.cos(angle) * ring,
      y: center + Math.sin(angle) * ring
    }
    positions.set(node.id, { ...anchor })
    anchors.set(node.id, anchor)
    velocities.set(node.id, { x: 0, y: 0 })
  })

  for (let tick = 0; tick < 180; tick += 1) {
    const alpha = 1 - tick / 180
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i]
        const b = nodes[j]
        const pa = positions.get(a.id)
        const pb = positions.get(b.id)
        let dx = pb.x - pa.x
        let dy = pb.y - pa.y
        const distance = Math.hypot(dx, dy) || 1
        dx /= distance
        dy /= distance
        const minDistance = (cardWidth + Math.max(nodeHeight(a, state.view), nodeHeight(b, state.view))) * 0.7
        const repulsion = Math.min(7, 90000 / (distance * distance)) * alpha
        const collision = distance < minDistance ? (minDistance - distance) * 0.04 : 0
        const force = repulsion + collision
        applyForce(velocities.get(a.id), -dx * force, -dy * force)
        applyForce(velocities.get(b.id), dx * force, dy * force)
      }
    }

    for (const edge of edges) {
      const source = byId.get(edge.from)
      const target = byId.get(edge.to)
      const pa = positions.get(source.id)
      const pb = positions.get(target.id)
      let dx = pb.x - pa.x
      let dy = pb.y - pa.y
      const distance = Math.hypot(dx, dy) || 1
      dx /= distance
      dy /= distance
      const desired = 390
      const force = (distance - desired) * 0.003 * alpha
      applyForce(velocities.get(source.id), dx * force, dy * force)
      applyForce(velocities.get(target.id), -dx * force, -dy * force)
    }

    for (const node of nodes) {
      const p = positions.get(node.id)
      const v = velocities.get(node.id)
      const anchor = anchors.get(node.id)
      applyForce(v, (anchor.x - p.x) * 0.018 * alpha, (anchor.y - p.y) * 0.018 * alpha)
      applyForce(v, (center - p.x) * 0.001 * alpha, (center - p.y) * 0.001 * alpha)
      p.x += v.x
      p.y += v.y
      v.x *= 0.72
      v.y *= 0.72
    }
  }

  const boxes = nodes.map((node) => ({
    node,
    x: positions.get(node.id).x,
    y: positions.get(node.id).y,
    width: cardWidth,
    height: nodeHeight(node, state.view)
  }))

  resolveDomainCollisions(boxes)

  const minX = Math.min(...boxes.map((box) => box.x))
  const minY = Math.min(...boxes.map((box) => box.y))
  const maxX = Math.max(...boxes.map((box) => box.x + box.width))
  const maxY = Math.max(...boxes.map((box) => box.y + box.height))
  const normalized = new Map()

  for (const box of boxes) {
    normalized.set(box.node.id, {
      x: box.x - minX,
      y: box.y - minY
    })
  }

  return {
    positions: normalized,
    width: maxX - minX,
    height: maxY - minY
  }
}

function orderDomainClusterForEdges(nodes) {
  if (nodes.length < 4) {
    return nodes
  }
  const ids = new Set(nodes.map((node) => node.id))
  const edges = state.graph.edges
    .filter((edge) => edge.type === 'domain-relation' && ids.has(edge.from) && ids.has(edge.to))
    .map((edge) => [edge.from, edge.to])
  if (edges.length < 2) {
    return nodes
  }

  let ordered = [...nodes]
  let bestScore = circularCrossingScore(ordered, edges)

  for (let pass = 0; pass < 6; pass += 1) {
    let improved = false
    for (let i = 0; i < ordered.length; i += 1) {
      for (let j = i + 1; j < ordered.length; j += 1) {
        const candidate = [...ordered]
        const tmp = candidate[i]
        candidate[i] = candidate[j]
        candidate[j] = tmp
        const score = circularCrossingScore(candidate, edges)
        if (
          score < bestScore ||
          (score === bestScore && seededUnit(`${candidate[i].id}:${candidate[j].id}:${pass}`) < 0.08)
        ) {
          ordered = candidate
          bestScore = score
          improved = true
        }
      }
    }
    if (!improved) {
      break
    }
  }

  return ordered
}

function circularCrossingScore(nodes, edges) {
  const indexById = new Map(nodes.map((node, index) => [node.id, index]))
  let crossings = 0
  let span = 0

  for (let i = 0; i < edges.length; i += 1) {
    const [a, b] = edges[i]
    const ai = indexById.get(a)
    const bi = indexById.get(b)
    if (ai === undefined || bi === undefined) {
      continue
    }
    span += circularSpan(ai, bi, nodes.length)
    for (let j = i + 1; j < edges.length; j += 1) {
      const [c, d] = edges[j]
      if (a === c || a === d || b === c || b === d) {
        continue
      }
      const ci = indexById.get(c)
      const di = indexById.get(d)
      if (ci === undefined || di === undefined) {
        continue
      }
      if (chordsCross(ai, bi, ci, di, nodes.length)) {
        crossings += 1
      }
    }
  }

  return crossings * 1000 + span
}

function circularSpan(a, b, length) {
  const direct = Math.abs(a - b)
  return Math.min(direct, length - direct)
}

function chordsCross(a, b, c, d, length) {
  if (a > b) {
    ;[a, b] = [b, a]
  }
  if (c > d) {
    ;[c, d] = [d, c]
  }
  const crossesDirect = (a < c && c < b && (d < a || b < d)) || (c < a && a < d && (b < c || d < b))
  const wrappedA = circularSpan(a, b, length) !== Math.abs(a - b)
  const wrappedC = circularSpan(c, d, length) !== Math.abs(c - d)
  if (!wrappedA && !wrappedC) {
    return (a < c && c < b && b < d) || (c < a && a < d && d < b)
  }
  return crossesDirect
}

function resolveDomainCollisions(boxes) {
  for (let tick = 0; tick < 120; tick += 1) {
    let moved = false
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]
        const b = boxes[j]
        const ax = a.x + a.width / 2
        const ay = a.y + a.height / 2
        const bx = b.x + b.width / 2
        const by = b.y + b.height / 2
        const overlapX = (a.width + b.width) / 2 + 34 - Math.abs(bx - ax)
        const overlapY = (a.height + b.height) / 2 + 34 - Math.abs(by - ay)
        if (overlapX <= 0 || overlapY <= 0) {
          continue
        }
        const pushX = bx >= ax ? overlapX / 2 : -overlapX / 2
        const pushY = by >= ay ? overlapY / 2 : -overlapY / 2
        if (overlapX < overlapY) {
          a.x -= pushX
          b.x += pushX
        } else {
          a.y -= pushY
          b.y += pushY
        }
        moved = true
      }
    }
    if (!moved) {
      return
    }
  }
}

function applyForce(velocity, x, y) {
  velocity.x += x
  velocity.y += y
}

function seededUnit(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 10000) / 10000
}

function buildDomainClusters(nodes, domainOrder) {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const adjacency = new Map(nodes.map((node) => [node.id, new Set()]))

  for (const edge of state.graph.edges) {
    if (edge.type !== 'domain-relation') {
      continue
    }
    if (!byId.has(edge.from) || !byId.has(edge.to)) {
      continue
    }
    adjacency.get(edge.from)?.add(edge.to)
    adjacency.get(edge.to)?.add(edge.from)
  }

  const seen = new Set()
  const relationClusters = []
  const isolatedByModule = new Map()

  for (const node of nodes) {
    if (seen.has(node.id)) {
      continue
    }
    const stack = [node.id]
    const ids = []
    seen.add(node.id)

    while (stack.length > 0) {
      const id = stack.pop()
      ids.push(id)
      for (const next of adjacency.get(id) ?? []) {
        if (seen.has(next)) {
          continue
        }
        seen.add(next)
        stack.push(next)
      }
    }

    const clusterNodes = ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .sort((a, b) => compareNodes(a, b, domainOrder))

    if (clusterNodes.length > 1) {
      const modules = unique(clusterNodes.map(domainEntityModule)).sort()
      relationClusters.push({
        key: `relations-${relationClusters.length}`,
        label: domainClusterLabel(clusterNodes, modules),
        nodes: clusterNodes,
        degree: clusterNodes.reduce((sum, item) => sum + (adjacency.get(item.id)?.size ?? 0), 0)
      })
    } else {
      const module = domainEntityModule(clusterNodes[0])
      if (!isolatedByModule.has(module)) {
        isolatedByModule.set(module, [])
      }
      isolatedByModule.get(module).push(clusterNodes[0])
    }
  }

  const isolatedClusters = [...isolatedByModule.entries()].map(([module, clusterNodes]) => ({
    key: `isolated-${module}`,
    label: `${formatModule(module)} standalone`,
    nodes: clusterNodes.filter(Boolean).sort((a, b) => compareNodes(a, b, domainOrder)),
    degree: 0
  }))

  return [...relationClusters, ...isolatedClusters]
    .filter((cluster) => cluster.nodes.length > 0)
    .sort((a, b) => b.degree - a.degree || b.nodes.length - a.nodes.length || a.label.localeCompare(b.label))
}

function domainClusterLabel(nodes, modules) {
  const names = nodes.slice(0, 2).map((node) => node.label)
  const suffix = nodes.length > names.length ? ` +${nodes.length - names.length}` : ''
  const moduleLabel = modules.length > 1 ? `${modules.length} modules` : formatModule(modules[0] ?? 'shared')
  return `${names.join(' / ')}${suffix} (${moduleLabel})`
}

function domainEntityModule(node) {
  const pattern = state.graph.projectMap?.modules?.backendEntityDomainPattern
  const pathModule = pattern ? node?.path?.match(new RegExp(pattern))?.[1] : null
  if (pathModule) {
    return pathModule.toLowerCase().replace(/[\s._]+/g, '-')
  }
  return node?.module ?? sharedModule()
}

function compareNodes(a, b, domainOrder) {
  if (state.view === 'domain') {
    return (domainOrder.get(a.id) ?? 9999) - (domainOrder.get(b.id) ?? 9999) || a.label.localeCompare(b.label)
  }
  return nodeSortWeight(a) - nodeSortWeight(b) || a.label.localeCompare(b.label)
}

function computeDomainOrder(nodes) {
  const visible = new Set(nodes.map((node) => node.id))
  const adjacency = new Map(nodes.map((node) => [node.id, new Set()]))
  const incoming = new Map(nodes.map((node) => [node.id, 0]))
  const outgoing = new Map(nodes.map((node) => [node.id, 0]))

  for (const edge of state.graph.edges) {
    if (edge.type !== 'domain-relation') {
      continue
    }
    if (!visible.has(edge.from) || !visible.has(edge.to)) {
      continue
    }
    adjacency.get(edge.from)?.add(edge.to)
    adjacency.get(edge.to)?.add(edge.from)
    outgoing.set(edge.from, (outgoing.get(edge.from) ?? 0) + 1)
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1)
  }

  const components = []
  const seen = new Set()
  const byId = new Map(nodes.map((node) => [node.id, node]))

  for (const node of nodes) {
    if (seen.has(node.id)) {
      continue
    }
    const stack = [node.id]
    const component = []
    seen.add(node.id)

    while (stack.length > 0) {
      const id = stack.pop()
      component.push(id)
      for (const next of adjacency.get(id) ?? []) {
        if (seen.has(next)) {
          continue
        }
        seen.add(next)
        stack.push(next)
      }
    }

    components.push(component)
  }

  components.sort((a, b) => {
    const aDegree = a.reduce((sum, id) => sum + (adjacency.get(id)?.size ?? 0), 0)
    const bDegree = b.reduce((sum, id) => sum + (adjacency.get(id)?.size ?? 0), 0)
    const aLabel = componentLabel(a, byId)
    const bLabel = componentLabel(b, byId)
    return bDegree - aDegree || aLabel.localeCompare(bLabel)
  })

  const order = new Map()
  let index = 0
  for (const component of components) {
    const sorted = component
      .map((id) => byId.get(id))
      .filter(Boolean)
      .sort((a, b) => {
        const aDegree = adjacency.get(a.id)?.size ?? 0
        const bDegree = adjacency.get(b.id)?.size ?? 0
        const aOutgoing = outgoing.get(a.id) ?? 0
        const bOutgoing = outgoing.get(b.id) ?? 0
        const aIncoming = incoming.get(a.id) ?? 0
        const bIncoming = incoming.get(b.id) ?? 0
        return bDegree - aDegree || bOutgoing - aOutgoing || aIncoming - bIncoming || a.label.localeCompare(b.label)
      })

    for (const node of sorted) {
      order.set(node.id, index)
      index += 1
    }
  }

  return order
}

function componentLabel(component, byId) {
  return (
    component
      .map((id) => byId.get(id)?.label)
      .filter(Boolean)
      .sort()[0] ?? ''
  )
}

function computeLayerLevels(nodes, layers, layoutLayerByNode) {
  const levels = new Map(layers.map((layer) => [layer, 1]))
  const moduleGroups = new Map()

  for (const node of nodes) {
    const key = `${node.module || 'shared'}::${layoutLayerByNode.get(node.id) ?? node.layer ?? 'unknown'}`
    if (!moduleGroups.has(key)) {
      moduleGroups.set(key, [])
    }
    moduleGroups.get(key).push(node)
  }

  for (const group of moduleGroups.values()) {
    const groupLevels = computeLevelByNode(group, layoutLayerByNode)
    for (const node of group) {
      const layer = layoutLayerByNode.get(node.id) ?? node.layer ?? 'unknown'
      levels.set(layer, Math.max(levels.get(layer) ?? 1, (groupLevels.get(node.id) ?? 0) + 1))
    }
  }

  return levels
}

function computeModuleLevelByNode(moduleGroup, layoutLayerByNode) {
  const all = [...moduleGroup.values()].flat()
  return computeLevelByNode(all, layoutLayerByNode)
}

function computeLevelByNode(nodes, layoutLayerByNode) {
  const visible = new Set(nodes.map((node) => node.id))
  const predecessors = new Map(nodes.map((node) => [node.id, []]))

  for (const edge of state.graph.edges) {
    if (!visible.has(edge.from) || !visible.has(edge.to)) {
      continue
    }
    if (layoutLayerByNode.get(edge.from) !== layoutLayerByNode.get(edge.to)) {
      continue
    }
    predecessors.get(edge.to)?.push(edge.from)
  }

  const memo = new Map()
  const visiting = new Set()

  const depth = (id) => {
    if (memo.has(id)) {
      return memo.get(id)
    }
    if (visiting.has(id)) {
      return 0
    }
    visiting.add(id)
    const value = Math.max(0, ...(predecessors.get(id) ?? []).map((parent) => depth(parent) + 1))
    visiting.delete(id)
    memo.set(id, value)
    return value
  }

  for (const node of nodes) {
    depth(node.id)
  }

  return memo
}

function inferAuxiliaryLayers(nodes) {
  const visible = new Map(nodes.map((node) => [node.id, node]))
  const inferred = new Map()
  for (const node of nodes) {
    if (node.layer !== 'auxiliary') {
      continue
    }
    const edge = state.graph.edges.find((candidate) => {
      if (candidate.from !== node.id && candidate.to !== node.id) {
        return false
      }
      const otherId = candidate.from === node.id ? candidate.to : candidate.from
      const other = visible.get(otherId)
      return other && other.layer !== 'auxiliary'
    })
    if (!edge) {
      continue
    }
    const otherId = edge.from === node.id ? edge.to : edge.from
    inferred.set(node.id, visible.get(otherId).layer)
  }
  return inferred
}

function moduleWeight(module) {
  if (module === sharedModule()) {
    return 999
  }
  return 0
}

function sharedModule() {
  return state.graph.projectMap?.modules?.shared ?? 'shared'
}

function nodeSortWeight(node) {
  const name = `${node.label} ${node.path ?? ''}`.toLowerCase()
  if (name.includes('routes')) {
    return 0
  }
  if (name.includes('page')) {
    return 1
  }
  if (name.includes('main')) {
    return 2
  }
  if (name.includes('index')) {
    return 3
  }
  if (name.includes('repository')) {
    return 8
  }
  if (name.includes('controller')) {
    return 9
  }
  if (name.includes('handler')) {
    return 10
  }
  return 5
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

export { layoutSystemModules, nodesForRender, render, renderingStrategies, scoreColor }
