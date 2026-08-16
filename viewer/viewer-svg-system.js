import { escapeHtml, formatModule, truncate } from '#viewer/viewer-utils.js'

export function systemModuleEdgeSvg(edge, nodeById) {
  const from = nodeById.get(edge.from)
  const to = nodeById.get(edge.to)
  const x1 = from.x + from.width / 2
  const y1 = from.y + from.height / 2
  const x2 = to.x + to.width / 2
  const y2 = to.y + to.height / 2
  const curve = Math.max(28, Math.abs(x2 - x1) * 0.28)
  const thickness = Math.round(Math.min(2.5, 0.7 + Math.log2(edge.count + 1) * 0.35) * 100) / 100
  const title = escapeHtml(`${edge.count} relations · ${edge.relationTypes.join(', ')}`)
  return (
    `<path d="M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}"` +
    ` fill="none" stroke="#94a3b8" stroke-width="${thickness}" stroke-opacity="0.2"` +
    ` marker-end="url(#module-arrow)"><title>${title}</title></path>`
  )
}

export function systemModuleNodeSvg(node) {
  const meta = node.meta
  const accent = moduleAccent(meta)
  const scope = moduleScope(meta)
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

export function graphModuleBandSvg(item, dimmed = false) {
  const rawLabel = item.label ?? formatModule(item.module)
  const pillPad = 10
  const pillHeight = 20
  const pillY = item.y + (28 - pillHeight) / 2
  const pillWidth = rawLabel.length * 7 + pillPad * 2
  return `
    <g class="${dimmed ? 'trace-background' : ''}">
      <rect class="module-band" x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}" rx="6" ry="6"></rect>
      <rect class="module-header-band" x="${item.x}" y="${item.y}" width="${item.width}" height="28" rx="6" ry="6"></rect>
      <rect class="module-header-band-fill" x="${item.x}" y="${item.y + 14}" width="${item.width}" height="14"></rect>
      <rect class="module-pill" x="${item.x + 10}" y="${pillY}" width="${pillWidth}" height="${pillHeight}" rx="4" ry="4"></rect>
      <text class="module-label" x="${item.x + 10 + pillPad}" y="${pillY + 14}">${escapeHtml(rawLabel)}</text>
    </g>
  `
}

function moduleAccent(meta) {
  if (meta.frontendCount && meta.backendCount) {
    return '#2563eb'
  }
  if (meta.frontendCount) {
    return '#0f766e'
  }
  if (meta.backendCount) {
    return '#7c3aed'
  }
  return '#64748b'
}

function moduleScope(meta) {
  if (meta.frontendCount && meta.backendCount) {
    return 'Frontend + backend'
  }
  if (meta.frontendCount) {
    return 'Frontend'
  }
  if (meta.backendCount) {
    return 'Backend'
  }
  return 'Shared support'
}
