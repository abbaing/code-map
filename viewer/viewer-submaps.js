import { requireGraphGateway } from '#viewer/viewer-data.js'
import { showToast } from '#viewer/viewer-feedback.js'
import { els, state } from '#viewer/viewer-state.js'
import { replaceSubgraphSelection } from '#viewer/viewer-subgraph-selection.js'
import { submapAvailability } from '#viewer/viewer-submap-availability.js'
import { renderSubmapPreview } from '#viewer/viewer-submap-preview.js'
import { latestSubmapRevisions } from '#viewer/viewer-submap-revisions.js'
import { escapeHtml } from '#viewer/viewer-utils.js'

let previewGeneration = 0

export async function loadSubmaps() {
  if (els.submapPreview) {
    closeSubmapPreview()
  }
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
    const availability = submapAvailability(submap, state.graph)
    const nodeIds = availability.availableNodes.map(({ id }) => id)
    if (!nodeIds.length) {
      throw new Error('None of this Submap’s nodes exist in the current graph.')
    }
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
    if (availability.missingNodes.length) {
      showToast(`${availability.missingNodes.length} unavailable nodes were omitted`, 'error')
    }
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
    const parentState = await loadParentRevision(submap)
    if (generation !== previewGeneration) {
      return false
    }
    state.previewSubmap = submap
    renderSubmapPreview(els, {
      submap,
      ...parentState,
      summaries: state.submaps,
      graph: state.graph
    })
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
  if (submap.status === 'invalid') {
    return invalidSubmapRowHtml(submap)
  }
  const statistics = submap.statistics ?? {}
  const revisionCount = submap.revisionCount ?? 1
  return `
    <button class="submap-row" data-submap-uid="${escapeHtml(submap.uid)}" aria-label="Preview ${escapeHtml(submap.name)}">
      <span class="submap-name">
        <strong>${escapeHtml(submap.name)}</strong>
        <small class="submap-kind">${escapeHtml(kindLabel(submap.kind))}</small>
      </span>
      <span class="submap-scope"><strong>${escapeHtml(contentLabel(statistics.nodes ?? 0))}</strong></span>
      <span class="submap-history">
        <strong>${escapeHtml(revisionLabel(revisionCount))}</strong>
        <small>Latest r${escapeHtml(submap.revision)}</small>
      </span>
      <time class="submap-updated" datetime="${escapeHtml(submap.createdAt)}">${escapeHtml(formatDate(submap.createdAt))}</time>
      <span class="submap-row-arrow" aria-hidden="true">
        <svg viewBox="0 0 20 20"><path d="m8 5 5 5-5 5" /></svg>
      </span>
    </button>
  `
}

export function currentNodeIds(submap, graph) {
  return submapAvailability(submap, graph).availableNodes.map(({ id }) => id)
}

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return value
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function revisionLabel(count) {
  return `${count} saved ${count === 1 ? 'version' : 'versions'}`
}

function contentLabel(count) {
  return `${count} ${count === 1 ? 'component' : 'components'}`
}

function kindLabel(kind) {
  return kind === 'trace' ? 'Saved trace' : 'Manual selection'
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
    return { parent: null, parentIssue: null }
  }
  try {
    const { submap: parent } = await requireGraphGateway().loadSubmap(submap.parentUid)
    return { parent, parentIssue: null }
  } catch {
    return { parent: null, parentIssue: 'Parent revision is unavailable, so changes cannot be compared.' }
  }
}

function invalidSubmapRowHtml(submap) {
  return `
    <div class="submap-row invalid" role="status">
      <span class="submap-name"><strong>${escapeHtml(submap.name)}</strong><small>${escapeHtml(submap.file)}</small></span>
      <span class="submap-kind">Unavailable</span>
      <span class="submap-row-issue">${escapeHtml(submap.issue?.message ?? 'Unable to read Submap')}</span>
    </div>
  `
}
