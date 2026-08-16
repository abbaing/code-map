import { requireGraphGateway } from '#viewer/viewer-data.js'
import { showToast } from '#viewer/viewer-feedback.js'
import { els, state } from '#viewer/viewer-state.js'
import { replaceSubgraphSelection } from '#viewer/viewer-subgraph-selection.js'
import { escapeHtml } from '#viewer/viewer-utils.js'

export async function loadSubmaps() {
  els.submapList.innerHTML = '<div class="submap-empty">Loading submaps...</div>'
  try {
    const result = await requireGraphGateway().listSubmaps()
    state.submaps = result.submaps
    renderSubmaps()
  } catch (error) {
    els.submapList.innerHTML = '<div class="submap-empty">Unable to load submaps.</div>'
    showToast(`Submaps failed: ${error.message}`, 'error')
  }
}

export function renderSubmaps() {
  const query = els.submapSearch.value.trim().toLowerCase()
  const visible = state.submaps.filter((submap) => submap.name.toLowerCase().includes(query))
  els.submapList.innerHTML = visible.length
    ? visible.map(submapRowHtml).join('')
    : '<div class="submap-empty">No named submaps match this search.</div>'
}

export async function openSubmap(uid) {
  try {
    const { submap } = await requireGraphGateway().loadSubmap(uid)
    const nodeIds = currentNodeIds(submap, state.graph)
    state.activeSubmap = {
      uid: submap.uid,
      id: submap.id,
      name: submap.metadata?.name ?? submap.id,
      revision: submap.revision,
      nodeIds: new Set(nodeIds)
    }
    els.selectionNameInput.value = state.activeSubmap.name
    replaceSubgraphSelection(nodeIds)
    state.fitView = true
    return true
  } catch (error) {
    showToast(`Submap failed: ${error.message}`, 'error')
    return false
  }
}

export function submapRowHtml(submap) {
  const statistics = submap.statistics ?? {}
  return `
    <button class="submap-row" data-submap-uid="${escapeHtml(submap.uid)}">
      <span class="submap-name"><strong>${escapeHtml(submap.name)}</strong><small>${escapeHtml(submap.file)}</small></span>
      <span>${escapeHtml(submap.kind)}</span>
      <span>${escapeHtml(statistics.nodes ?? 0)}</span>
      <span>${escapeHtml(statistics.edges ?? 0)}</span>
      <span>r${escapeHtml(submap.revision)}</span>
      <time datetime="${escapeHtml(submap.createdAt)}">${escapeHtml(formatDate(submap.createdAt))}</time>
    </button>
  `
}

export function currentNodeIds(submap, graph) {
  const available = new Set(graph.nodes.map((node) => node.id))
  return submap.nodes.map((node) => node.id).filter((id) => available.has(id))
}

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString()
}
