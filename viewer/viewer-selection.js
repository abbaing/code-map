import { render } from '#viewer/viewer-graph.js'
import { hidePopover, movePopover, showPopover } from '#viewer/viewer-popover.js'
import { coverageDetail, findingsDetail, qualityDetail, reviewDetail } from '#viewer/viewer-selection-quality.js'
import { edgeLine, selectedNodeDetailHtml } from '#viewer/viewer-selection-detail.js'
import { state } from '#viewer/viewer-state.js'

let selectionOperations = null

function configureViewerSelection(operations) {
  if (!operations || typeof operations.renderModuleDetail !== 'function') {
    throw new TypeError('Viewer selection operations must implement renderModuleDetail()')
  }
  selectionOperations = operations
}

function renderSelectionDetail() {
  if (!selectionOperations) {
    throw new Error('Viewer selection operations are not configured')
  }
  selectionOperations.renderModuleDetail()
}

function selectNode(id) {
  state.selectedId = id
  state.showAllTrace = false
  hidePopover()
  if (state.view === 'graph' || state.view === 'domain') {
    render()
  }
  renderSelectionDetail()
}

function clearSelectedNode() {
  const hadSelection = Boolean(state.selectedId)
  state.selectedId = null
  state.showAllTrace = false
  state.trace = null
  hidePopover()
  if (hadSelection && (state.view === 'graph' || state.view === 'domain')) {
    render()
  }
  if (hadSelection) {
    renderSelectionDetail()
  }
}

function connectedEdgeIds(nodeId) {
  if (!nodeId) {
    return new Set()
  }
  const connected = state.graph.edges.filter((edge) => edge.from === nodeId || edge.to === nodeId)
  return new Set(connected.map((edge) => edge.id))
}

export {
  clearSelectedNode,
  configureViewerSelection,
  connectedEdgeIds,
  coverageDetail,
  edgeLine,
  findingsDetail,
  hidePopover,
  movePopover,
  qualityDetail,
  reviewDetail,
  selectNode,
  selectedNodeDetailHtml,
  showPopover
}
