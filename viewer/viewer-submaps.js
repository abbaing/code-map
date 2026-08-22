import { requireGraphGateway } from '#viewer/viewer-data.js'
import { showToast } from '#viewer/viewer-feedback.js'
import { els, state } from '#viewer/viewer-state.js'
import { replaceSubgraphSelection, updateSelectionBar } from '#viewer/viewer-subgraph-selection.js'
import { submapAvailability } from '#viewer/viewer-submap-availability.js'
import { latestSubmapRevisions, revisionsForSubmap } from '#viewer/viewer-submap-revisions.js'
import { escapeHtml } from '#viewer/viewer-utils.js'

const pendingDeletes = new Set()

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
    ? visible.map((submap) => submapRowHtml(submap, revisionsForSubmap(state.submaps, submap.id))).join('')
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

export async function deleteSubmap(uid, confirmDeletion = globalThis.confirm) {
  if (pendingDeletes.has(uid)) {
    return false
  }
  const summary = state.submaps.find((submap) => submap.uid === uid)
  const name = summary?.name ?? 'this submap'
  if (typeof confirmDeletion !== 'function' || !confirmDeletion(`Delete "${name}" and all saved versions?`)) {
    return false
  }
  pendingDeletes.add(uid)
  try {
    const result = await requireGraphGateway().deleteSubmap(uid)
    state.submaps = state.submaps.filter((submap) => submap.id !== result.id)
    if (state.activeSubmap?.id === result.id) {
      state.activeSubmap = null
      updateSelectionBar()
    }
    renderSubmaps()
    showToast(`Deleted ${name}`, 'success')
    return true
  } catch (error) {
    showToast(`Submap deletion failed: ${error.message}`, 'error')
    return false
  } finally {
    pendingDeletes.delete(uid)
  }
}

export function submapRowHtml(submap, revisions = [submap]) {
  if (submap.status === 'invalid') {
    return invalidSubmapRowHtml(submap)
  }
  const statistics = submap.statistics ?? {}
  const revisionCount = submap.revisionCount ?? 1
  const name = escapeHtml(submap.name)
  return `
    <div class="submap-row-wrap">
      <button class="submap-row" data-submap-uid="${escapeHtml(submap.uid)}" aria-label="Open ${name} in graph">
        <span class="submap-name">
          <strong>${name}</strong>
          <small class="submap-kind">${escapeHtml(kindLabel(submap.kind))}</small>
        </span>
        <span class="submap-scope"><strong>${escapeHtml(contentLabel(statistics.nodes ?? 0))}</strong></span>
        <span class="submap-history">
          <strong>${escapeHtml(revisionLabel(revisionCount))}</strong>
          <small>Latest r${escapeHtml(submap.revision)}</small>
        </span>
        <time class="submap-updated" datetime="${escapeHtml(submap.createdAt)}">${escapeHtml(formatDate(submap.createdAt))}</time>
        <span></span>
      </button>
      <details class="submap-options">
        <summary aria-label="Options for ${name}">&#8943;</summary>
        <div class="submap-options-menu" role="menu">
          ${revisionOptionsHtml(revisions, submap.uid)}
          <button class="submap-option submap-option-danger" role="menuitem" data-delete-submap-uid="${escapeHtml(submap.uid)}">Delete submap</button>
        </div>
      </details>
    </div>
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
  return kind === 'execution-trace' || kind === 'trace' ? 'Saved trace' : 'Manual selection'
}

function revisionOptionsHtml(revisions, latestUid) {
  if (revisions.length < 2) {
    return ''
  }
  return `
    <span class="submap-options-label">Open version</span>
    ${revisions.map((revision) => revisionOptionHtml(revision, latestUid)).join('')}
    <span class="submap-options-separator"></span>
  `
}

function revisionOptionHtml(revision, latestUid) {
  const current = revision.uid === latestUid
  return `
    <button class="submap-option submap-version-option" role="menuitem" data-open-submap-uid="${escapeHtml(revision.uid)}">
      <span>Revision ${escapeHtml(revision.revision)}${current ? ' · latest' : ''}</span>
      <small>${escapeHtml(formatDate(revision.createdAt))}</small>
    </button>
  `
}

async function loadSubmapDocument(uid) {
  const { submap } = await requireGraphGateway().loadSubmap(uid)
  return submap
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
