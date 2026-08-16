import { render } from '#viewer/viewer-graph.js'
import { els, state } from '#viewer/viewer-state.js'

export function replaceSubgraphSelection(nodeIds) {
  state.subgraphNodeIds = new Set(nodeIds)
  updateSelectionBar()
  renderSelection()
}

export function toggleSubgraphNode(nodeId) {
  const selected = new Set(state.subgraphNodeIds)
  if (selected.has(nodeId)) {
    selected.delete(nodeId)
  } else {
    selected.add(nodeId)
  }
  state.subgraphNodeIds = selected
  updateSelectionBar()
  renderSelection()
}

export function clearSubgraphSelection() {
  if (!state.subgraphNodeIds.size) {
    return
  }
  state.subgraphNodeIds = new Set()
  updateSelectionBar()
  renderSelection()
}

export function updateSelectionBar() {
  if (!els?.selectionBar) {
    return
  }
  const count = state.subgraphNodeIds.size
  els.selectionCount.textContent = `${count} ${count === 1 ? 'node' : 'nodes'} selected`
  els.selectionBar.classList.toggle('hidden', count === 0)
}

function renderSelection() {
  if (state.view === 'graph' || state.view === 'domain') {
    render()
  }
}
