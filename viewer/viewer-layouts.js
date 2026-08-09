import { layerOrder, state } from './viewer-state.js'
import { nodeHeight } from './viewer-trace.js'
import { formatModule, unique } from './viewer-utils.js'

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

export { layoutNodes, layoutSystemModules }
