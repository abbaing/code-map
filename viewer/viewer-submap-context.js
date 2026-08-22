import { els, state } from '#viewer/viewer-state.js'

const allHealthLevels = ['excellent', 'very-good', 'good', 'fair', 'low', 'critical']

export function resetSubmapGraphContext() {
  Object.assign(state, {
    activeModule: null,
    selectedId: null,
    trace: null,
    showAllTrace: false,
    zoom: 1,
    panX: 0,
    panY: 0,
    fitView: true,
    dragMoved: false,
    suppressOutsideReset: false,
    selectedTypes: new Set(state.graph.nodes.map(({ type }) => type)),
    selectedHealth: new Set(allHealthLevels)
  })
  resetFilterControls()
}

function resetFilterControls() {
  if (els.graphSearch) {
    els.graphSearch.value = ''
  }
  for (const checkbox of [els.orphansOnly, els.uncoveredOnly, els.reviewOnly, els.findingsOnly, els.hideAuxiliary]) {
    if (checkbox) {
      checkbox.checked = false
    }
  }
  checkAll(els.typeChecks, 'input[data-type]')
  checkAll(els.healthChecks, 'input[data-health]')
  els.graphFilterPanel?.classList.add('hidden')
  els.graphFilterBtn?.classList.remove('active')
  els.selectionContextMenu?.classList.add('hidden')
  if (els.popover?.style) {
    els.popover.style.display = 'none'
  }
}

function checkAll(container, selector) {
  for (const checkbox of container?.querySelectorAll?.(selector) ?? []) {
    checkbox.checked = true
  }
}
