import { showToast } from '#viewer/viewer-feedback.js'
import { els, state } from '#viewer/viewer-state.js'

export function applyPan() {
  const svg = els.graph
  const width = svg.parentElement.clientWidth || 900
  const height = svg.parentElement.clientHeight || 700
  svg.setAttribute('viewBox', `${state.panX} ${state.panY} ${width / state.zoom} ${height / state.zoom}`)
  els.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`
}

export function setZoom(nextZoom) {
  state.zoom = boundedZoom(nextZoom)
  applyPan()
}

export function resetZoom() {
  Object.assign(state, { zoom: 1, panX: 0, panY: 0 })
  applyPan()
  showToast('Zoom reset')
}

export function zoomAt(nextZoom, clientX, clientY) {
  const previousZoom = state.zoom
  const zoom = boundedZoom(nextZoom)
  if (zoom === previousZoom) {
    return
  }
  const rect = els.graph.getBoundingClientRect()
  const mouseX = clientX - rect.left
  const mouseY = clientY - rect.top
  const svgX = state.panX + mouseX / previousZoom
  const svgY = state.panY + mouseY / previousZoom
  state.zoom = zoom
  state.panX = svgX - mouseX / zoom
  state.panY = svgY - mouseY / zoom
  applyPan()
}

function boundedZoom(value) {
  return Math.min(2.5, Math.max(0.2, Number(value.toFixed(2))))
}
