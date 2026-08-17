import { requireGraphGateway } from '#viewer/viewer-data.js'
import { showToast } from '#viewer/viewer-feedback.js'
import { els, state } from '#viewer/viewer-state.js'
import {
  clearSubgraphSelection,
  isSubmapSelectionDirty,
  updateSelectionBar
} from '#viewer/viewer-subgraph-selection.js'

export async function createTraceSubmap() {
  els.actionsMenu.classList.add('hidden')
  const trace = state.trace
  if (!trace?.nodeIds?.size) {
    showToast('Select a component or table first', 'error')
    return
  }
  els.createTraceSubmapBtn.disabled = true
  try {
    const selected = state.graph.nodes.find((node) => node.id === trace.selectedId)
    const result = await requireGraphGateway().createTraceSubmap({
      id: `trace-${traceBaseName(selected) || 'selection'}`,
      nodeIds: [...trace.nodeIds],
      edgeIds: [...trace.edgeIds],
      selectedNodeId: trace.selectedId,
      complete: trace.complete
    })
    if (!result.ok) {
      throw new Error(result.error)
    }
    showToast(`Submap created: ${result.file}`)
  } catch (error) {
    showToast(`Submap failed: ${error.message}`, 'error')
  } finally {
    els.createTraceSubmapBtn.disabled = false
  }
}

export async function createSelectionSubmap() {
  closeSelectionContextMenu()
  const name = els.selectionNameInput.value.trim()
  if (!name || !state.subgraphNodeIds.size) {
    showToast('Enter a name and select at least one node', 'error')
    return
  }
  els.selectionCreateBtn.disabled = true
  try {
    const result = await requireGraphGateway().createSelectionSubmap({
      name,
      nodeIds: [...state.subgraphNodeIds]
    })
    showToast(`Submap created: ${result.file}`)
    state.activeSubmap = null
    els.selectionNameInput.value = ''
    clearSubgraphSelection()
  } catch (error) {
    showToast(`Submap failed: ${error.message}`, 'error')
  } finally {
    els.selectionCreateBtn.disabled = false
  }
}

export async function saveSubmapRevision() {
  closeSelectionContextMenu()
  const active = state.activeSubmap
  if (!active || !state.subgraphNodeIds.size || !isSubmapSelectionDirty(active, state.subgraphNodeIds)) {
    return
  }
  setRevisionBusy(true)
  try {
    const result = await requireGraphGateway().reviseSubmap({
      uid: active.uid,
      nodeIds: [...state.subgraphNodeIds]
    })
    state.activeSubmap = {
      ...active,
      uid: result.uid,
      revision: result.revision,
      nodeIds: new Set(state.subgraphNodeIds)
    }
    showToast(`Submap revision ${result.revision} saved: ${result.file}`)
  } catch (error) {
    showToast(`Submap failed: ${error.message}`, 'error')
  } finally {
    setRevisionBusy(false)
    updateSelectionBar()
  }
}

function setRevisionBusy(busy) {
  els.selectionSaveBtn.disabled = busy
  if (els.selectionContextSaveBtn) {
    els.selectionContextSaveBtn.disabled = busy
  }
}

function closeSelectionContextMenu() {
  els.selectionContextMenu?.classList.add('hidden')
}

function traceBaseName(selected) {
  return (selected?.label ?? 'trace')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}
