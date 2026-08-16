import { state } from '#viewer/viewer-state.js'
import { escapeHtml } from '#viewer/viewer-utils.js'

export function arrowDefinition() {
  return `<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#9aa4b2"></path></marker></defs>`
}

export function edgeSvg(edge, nodeById, highlighted, dimmed = false, focused = false) {
  const from = nodeById.get(edge.from)
  const to = nodeById.get(edge.to)
  if (!from || !to) {
    return ''
  }
  if (state.view === 'domain') {
    return domainEdgeSvg({ from, to, highlighted, dimmed, focused })
  }
  const forward = from.x <= to.x
  const x1 = forward ? from.x + from.width : from.x
  const y1 = from.y + from.height / 2
  const x2 = forward ? to.x : to.x + to.width
  const y2 = to.y + to.height / 2
  const mid = forward ? Math.max(x1 + 24, (x1 + x2) / 2) : Math.min(x1 - 24, (x1 + x2) / 2)
  const classes = edgeClasses(edge, highlighted, focused, dimmed)
  return `<path class="${classes}" d="M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}" marker-end="url(#arrow)" />`
}

function domainEdgeSvg({ from, to, highlighted, dimmed, focused }) {
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
  const classes = `edge domain-edge ${highlighted ? 'highlight' : ''} ${focused ? 'focused' : ''} ${dimmed ? 'dimmed' : ''}`
  return `<path class="${classes}" d="M ${source.x} ${source.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${target.x} ${target.y}" marker-end="url(#arrow)" />`
}

function connectionPoint(node, other) {
  const center = { x: node.x + node.width / 2, y: node.y + node.height / 2 }
  const otherCenter = { x: other.x + other.width / 2, y: other.y + other.height / 2 }
  const dx = otherCenter.x - center.x
  const dy = otherCenter.y - center.y
  const horizontal = Math.abs(dx) / Math.max(node.width, 1) > Math.abs(dy) / Math.max(node.height, 1)
  return horizontal
    ? { x: dx >= 0 ? node.x + node.width : node.x, y: center.y }
    : { x: center.x, y: dy >= 0 ? node.y + node.height : node.y }
}

function edgeClasses(edge, highlighted, focused, dimmed) {
  return `edge edge-type-${escapeHtml(edge.type)} confidence-${escapeHtml(edge.confidence ?? 'medium')} ${highlighted ? 'highlight' : ''} ${focused ? 'focused' : ''} ${dimmed ? 'dimmed' : ''}`
}
