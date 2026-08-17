import { render } from '#viewer/viewer-graph.js'
import { els, state } from '#viewer/viewer-state.js'
import { isSubmapSelectionDirty } from '#viewer/viewer-submap-edit-state.js'

export { isSubmapSelectionDirty } from '#viewer/viewer-submap-edit-state.js'

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

export function selectVisibleSubgraphNodes() {
  replaceSubgraphSelection(renderedNodeIds())
}

export function invertVisibleSubgraphSelection() {
  const selected = state.subgraphNodeIds
  replaceSubgraphSelection(renderedNodeIds().filter((nodeId) => !selected.has(nodeId)))
}

export function clearSubgraphSelection() {
  if (!state.subgraphNodeIds.size) {
    return
  }
  state.subgraphNodeIds = new Set()
  updateSelectionBar()
  renderSelection()
}

export function discardSubmapChanges() {
  if (!state.activeSubmap) {
    return
  }
  replaceSubgraphSelection(state.activeSubmap.nodeIds)
}

export function updateSelectionBar() {
  if (!els?.selectionBar) {
    return
  }
  const count = state.subgraphNodeIds.size
  const active = state.activeSubmap
  const dirty = isSubmapSelectionDirty(active, state.subgraphNodeIds)
  els.selectionCount.textContent = `${count} ${count === 1 ? 'node' : 'nodes'} selected`
  els.selectionBar.classList.toggle('hidden', count === 0 && !active)
  els.selectionNameInput.readOnly = Boolean(active)
  els.selectionCreateBtn.classList.toggle('hidden', Boolean(active))
  els.selectionSaveBtn.classList.toggle('hidden', !active)
  els.selectionDiscardBtn.classList.toggle('hidden', !active)
  els.selectionSaveBtn.disabled = !dirty || count === 0
  els.selectionDiscardBtn.disabled = !dirty
  els.selectionState.textContent = active ? (dirty ? 'Unsaved changes' : `Saved r${active.revision}`) : ''
  els.selectionState.classList.toggle('dirty', dirty)
}

function renderSelection() {
  if (state.view === 'graph' || state.view === 'domain') {
    render()
  }
}

function renderedNodeIds() {
  return [...els.graph.querySelectorAll('.node[data-id]')].map(({ dataset }) => dataset.id).filter(Boolean)
}
