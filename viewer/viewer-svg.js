import { colors, state } from '#viewer/viewer-state.js'
import { escapeHtml, formatModule, formatType, truncate } from '#viewer/viewer-utils.js'

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

export {
  edgeSvg,
  graphModuleBandSvg,
  nodeDomainSvg,
  nodeGraphSvg,
  scoreColor,
  systemModuleEdgeSvg,
  systemModuleNodeSvg
}
