import { applyFilters, initializeFilters, loadGraph, requireGraphGateway } from '#viewer/viewer-data.js'
import { buttonBusy, buttonIdle, showToast } from '#viewer/viewer-feedback.js'
import { els, state } from '#viewer/viewer-state.js'
import { clearSubgraphSelection } from '#viewer/viewer-subgraph-selection.js'

export async function refreshGraph() {
  buttonBusy(els.refreshBtn)
  els.status.textContent = 'Refreshing...'
  try {
    const result = await requireGraphGateway().scan()
    if (!result.ok) {
      throw new Error(result.error)
    }
    await loadGraph()
    els.status.textContent = 'Map updated'
    showToast(`Map updated: ${result.stats.nodes.toLocaleString()} nodes`, 'success')
  } catch (error) {
    els.status.textContent = `Error: ${error.message}`
    showToast(`Refresh failed: ${error.message}`, 'error')
  } finally {
    buttonIdle(els.refreshBtn)
  }
}

export function exportGraph() {
  els.exportBtn.disabled = true
  try {
    downloadJson(state.graph, `code-map-${new Date().toISOString().slice(0, 10)}.json`)
    showToast('Graph exported')
  } catch (error) {
    showToast(`Export failed: ${error.message}`, 'error')
  } finally {
    window.setTimeout(() => {
      els.exportBtn.disabled = false
    }, 250)
  }
}

export function exportSubgraphSelection() {
  closeSelectionContextMenu()
  if (!state.subgraphNodeIds.size) {
    showToast('Select at least one node first', 'error')
    return
  }
  const name = filenamePart(els.selectionNameInput.value) || 'selection'
  downloadJson(selectedGraph(state.graph, state.subgraphNodeIds), `code-map-${name}.json`)
  showToast('Selection exported')
}

export function selectedGraph(graph, selectedNodeIds) {
  const ids = new Set(selectedNodeIds)
  const nodes = graph.nodes.filter((node) => ids.has(node.id))
  const edges = graph.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to))
  const findings = (graph.findings ?? []).filter((finding) => ids.has(finding.nodeId))
  const orphans = (graph.orphans ?? []).filter((orphan) => ids.has(typeof orphan === 'string' ? orphan : orphan.id))
  return structuredClone({
    ...graph,
    nodes,
    edges,
    findings,
    orphans,
    stats: { ...graph.stats, nodes: nodes.length, edges: edges.length, findings: findings.length }
  })
}

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
    const base = traceBaseName(selected)
    const result = await requireGraphGateway().createTraceSubmap({
      id: `trace-${base || 'selection'}`,
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
    els.selectionNameInput.value = ''
    clearSubgraphSelection()
  } catch (error) {
    showToast(`Submap failed: ${error.message}`, 'error')
  } finally {
    els.selectionCreateBtn.disabled = false
  }
}

function closeSelectionContextMenu() {
  els.selectionContextMenu?.classList.add('hidden')
}

function filenamePart(value) {
  return value
    .trim()
    .replace(/[^a-z0-9._-]+/giu, '-')
    .replace(/^-+|-+$/gu, '')
    .toLowerCase()
}

export function importGraph(file) {
  els.importLabel.classList.add('disabled')
  const reader = new FileReader()
  reader.onload = () => finishGraphImport(reader)
  reader.onerror = () => resetImport('Failed to read file')
  reader.readAsText(file)
}

function finishGraphImport(reader) {
  try {
    state.graph = JSON.parse(String(reader.result))
    initializeFilters()
    applyFilters()
    els.status.textContent = 'Graph imported'
    showToast(`Imported: ${state.graph.stats.nodes} nodes, ${state.graph.stats.edges} edges`)
  } catch (error) {
    showToast(`Import failed: ${error.message}`, 'error')
  } finally {
    resetImport()
  }
}

function resetImport(error) {
  if (error) {
    showToast(error, 'error')
  }
  els.importLabel.classList.remove('disabled')
  els.importFile.value = ''
}

function traceBaseName(selected) {
  return (selected?.label ?? 'trace')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function downloadJson(value, filename) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
