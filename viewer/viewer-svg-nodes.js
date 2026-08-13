import { colors, state } from '#viewer/viewer-state.js'
import { escapeHtml, formatModule, formatType, truncate } from '#viewer/viewer-utils.js'

export function nodeGraphSvg(node, orphan, dimmed = false, focused = false, managedEntityCount = 0) {
  const presentation = graphNodePresentation(node, orphan, dimmed, focused, managedEntityCount)
  return `
    <g class="${presentation.classes}" data-id="${escapeHtml(node.id)}" transform="translate(${node.x}, ${node.y})">
      ${presentation.title}
      <rect width="${node.width}" height="${node.height}"></rect>
      <rect width="5" height="${node.height}" fill="${colors[node.type] || '#64748b'}" rx="5"></rect>
      <text x="12" y="20">${escapeHtml(truncate(node.label, 24))}</text>
      <text class="type" x="12" y="38">${escapeHtml(truncate(presentation.secondary, 30))}</text>
      ${presentation.metrics}
      ${presentation.reviewBadge}
      ${presentation.testIndicator}
    </g>
  `
}

export function nodeDomainSvg(node, orphan, dimmed = false, focused = false) {
  return node.type === 'entity'
    ? umlEntitySvg(node, orphan, dimmed, focused)
    : nodeGraphSvg(node, orphan, dimmed, focused)
}

export function scoreColor(score) {
  const hue = ((Math.max(1, Math.min(10, score)) - 1) / 9) * 120
  return `hsl(${hue}, 72%, 42%)`
}

function umlEntitySvg(node, orphan, dimmed, focused) {
  const properties = node.meta?.domain?.properties ?? []
  const visible = properties.slice(0, 10)
  const remaining = Math.max(0, properties.length - visible.length)
  const rows = visible
    .map(
      (property, index) => `
    <text class="uml-property" x="12" y="${58 + index * 16}">
      ${escapeHtml(truncate(`${property.name}: ${property.type}`, 34))}
    </text>
  `
    )
    .join('')
  const more = remaining
    ? `<text class="uml-property muted" x="12" y="${58 + visible.length * 16}">+ ${remaining} more</text>`
    : ''
  const classes = `node uml-entity ${node.id === state.selectedId ? 'selected' : ''} ${focused ? 'focused' : ''} ${orphan ? 'orphan' : ''} ${dimmed ? 'dimmed' : ''}`
  return `
    <g class="${classes}" data-id="${escapeHtml(node.id)}" transform="translate(${node.x}, ${node.y})">
      <rect width="${node.width}" height="${node.height}"></rect>
      <rect class="uml-header" width="${node.width}" height="36"></rect>
      <text class="uml-title" x="12" y="22">${escapeHtml(truncate(node.label, 30))}</text>
      <line class="uml-divider" x1="0" y1="36" x2="${node.width}" y2="36"></line>
      ${rows}
      ${more}
    </g>
  `
}

function nodeClasses(node, orphan, dimmed, focused, support) {
  return (
    `node ${node.id === state.selectedId ? 'selected' : ''} ${focused ? 'focused' : ''}` +
    ` ${support ? 'trace-support' : ''} ${orphan ? 'orphan' : ''} ${dimmed ? 'dimmed' : ''}` +
    ` ${node.layer === 'auxiliary' ? 'auxiliary' : ''}`
  )
}

function graphNodePresentation(node, orphan, dimmed, focused, managedCount) {
  const managedLabel = `${managedCount} ${managedCount === 1 ? 'entity' : 'entities'}`
  return {
    metrics: qualityIndicator(node),
    testIndicator: testIndicator(node),
    reviewBadge: reviewBadge(node),
    secondary: secondaryLabel(node, managedCount, managedLabel),
    classes: nodeClasses(node, orphan, dimmed, focused, isTraceSupport(node, focused)),
    title: managedEntitiesTitle(node, managedCount, managedLabel)
  }
}

function qualityIndicator(node) {
  return node.meta?.quality ? qualityMetric(node.meta.quality) : ''
}

function testIndicator(node) {
  return node.meta?.coverage?.hasCoverage ? coverageIndicator(node) : ''
}

function reviewBadge(node) {
  return node.meta?.review ? reviewIndicator(node) : ''
}

function isTraceSupport(node, focused) {
  return Boolean(state.trace && focused && (node.type === 'hook' || node.layer === 'auxiliary'))
}

function managedEntitiesTitle(node, count, label) {
  return node.type === 'data-context' && count > 0
    ? `<title>${label} managed; individual DbSet relations are summarized</title>`
    : ''
}

function secondaryLabel(node, managedCount, managedLabel) {
  if (node.type === 'endpoint' && node.meta?.backend?.action) {
    return node.meta.backend.action
  }
  if (node.type === 'data-context' && managedCount > 0) {
    return `${formatType(node.type)} · ${managedLabel}`
  }
  return `${formatType(node.type)} - ${formatModule(node.module)}`
}

function qualityMetric(quality) {
  return `
    <rect class="metric-box" x="12" y="47" width="64" height="13" style="fill: ${scoreColor(quality.score)}" rx="3"></rect>
    <text class="metric-label" x="18" y="57">Q ${quality.score}/10</text>
  `
}

function coverageIndicator(node) {
  return `
    <g class="test-indicator" transform="translate(${node.width - 43}, 8)" aria-label="Related test detected">
      <title>Related test detected</title><rect width="35" height="16" rx="4"></rect>
      <text x="17.5" y="11.5" text-anchor="middle">TEST</text>
    </g>
  `
}

function reviewIndicator(node) {
  return `
    <g transform="translate(${node.width - 46}, 8)" aria-label="A revisar">
      <circle class="review-badge" cx="8" cy="8" r="8"></circle><text class="review-label" x="5" y="12">!</text>
    </g>
  `
}
