import { requireGraphGateway } from '#viewer/viewer-data.js'
import { showToast } from '#viewer/viewer-feedback.js'
import { els, state } from '#viewer/viewer-state.js'
import { replaceSubgraphSelection } from '#viewer/viewer-subgraph-selection.js'
import { renderSubmapPreview } from '#viewer/viewer-submap-preview.js'
import { latestSubmapRevisions } from '#viewer/viewer-submap-revisions.js'
import { escapeHtml } from '#viewer/viewer-utils.js'

let previewGeneration = 0

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
  const visible = latestSubmapRevisions(state.submaps).filter((submap) => submap.name.toLowerCase().includes(query))
  els.submapList.innerHTML = visible.length
    ? visible.map(submapRowHtml).join('')
    : '<div class="submap-empty">No named submaps match this search.</div>'
}

export async function openSubmap(uid) {
  try {
    const submap = await loadSubmapDocument(uid)
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

export async function previewSubmap(uid) {
  const generation = ++previewGeneration
  els.submapPreview.classList.remove('hidden')
  els.submapPreviewTitle.textContent = 'Loading...'
  els.submapPreviewMeta.textContent = ''
  els.submapPreviewBody.innerHTML = ''
  try {
    const { submap } = await requireGraphGateway().loadSubmap(uid)
    const parent = await loadParentRevision(submap)
    if (generation !== previewGeneration) {
      return false
    }
    state.previewSubmap = submap
    renderSubmapPreview(els, submap, parent, state.submaps)
    return true
  } catch (error) {
    if (generation !== previewGeneration) {
      return false
    }
    closeSubmapPreview()
    showToast(`Submap preview failed: ${error.message}`, 'error')
    return false
  }
}

export function closeSubmapPreview() {
  previewGeneration += 1
  state.previewSubmap = null
  els.submapPreview.classList.add('hidden')
}

export function submapRowHtml(submap) {
  const statistics = submap.statistics ?? {}
  return `
    <button class="submap-row" data-submap-uid="${escapeHtml(submap.uid)}" aria-label="Preview ${escapeHtml(submap.name)}">
      <span class="submap-name"><strong>${escapeHtml(submap.name)}</strong><small>${escapeHtml(submap.file)}</small></span>
      <span>${escapeHtml(submap.kind)}</span>
      <span>${escapeHtml(statistics.nodes ?? 0)}</span>
      <span>${escapeHtml(statistics.edges ?? 0)}</span>
      <span>r${escapeHtml(submap.revision)} · ${escapeHtml(revisionLabel(submap.revisionCount ?? 1))}</span>
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

function revisionLabel(count) {
  return `${count} ${count === 1 ? 'revision' : 'revisions'}`
}

async function loadSubmapDocument(uid) {
  if (state.previewSubmap?.uid === uid) {
    return state.previewSubmap
  }
  const { submap } = await requireGraphGateway().loadSubmap(uid)
  return submap
}

async function loadParentRevision(submap) {
  if (!submap.parentUid) {
    return null
  }
  const { submap: parent } = await requireGraphGateway().loadSubmap(submap.parentUid)
  return parent
}
