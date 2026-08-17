import { compareSubmapRevisions, revisionsForSubmap } from '#viewer/viewer-submap-revisions.js'
import { escapeHtml } from '#viewer/viewer-utils.js'

export function renderSubmapPreview(elements, submap, parent, summaries) {
  const name = submap.metadata?.name ?? submap.id
  elements.submapPreviewTitle.textContent = name
  elements.submapPreviewMeta.textContent = `${submap.metadata?.kind ?? 'selection'} · revision ${submap.revision}`
  elements.submapPreviewBody.innerHTML = submapPreviewHtml(submap, parent, summaries)
  elements.submapPreviewOpenBtn.dataset.submapUid = submap.uid
}

export function submapPreviewHtml(submap, parent, summaries) {
  const nodes = submap.nodes.slice(0, 20)
  const remaining = submap.nodes.length - nodes.length
  return `
    ${revisionHistoryHtml(submap, summaries)}
    ${revisionComparisonHtml(submap, parent)}
    <div class="submap-preview-stats">
      ${previewStat(submap.nodes.length, 'Nodes')}
      ${previewStat(submap.edges.length, 'Edges')}
      ${previewStat(submap.boundaries?.length ?? 0, 'Boundaries')}
    </div>
    <div class="submap-preview-nodes">${nodes.map(previewNode).join('')}</div>
    ${remaining > 0 ? `<p class="submap-preview-more">${remaining} more nodes</p>` : ''}
  `
}

function revisionHistoryHtml(submap, summaries) {
  const revisions = revisionsForSubmap(summaries, submap.id)
  return `
    <section class="submap-revisions" aria-label="Revision history">
      <h3>Revision history</h3>
      <div>${revisions.map((revision) => revisionButton(revision, submap.uid)).join('')}</div>
    </section>
  `
}

function revisionComparisonHtml(submap, parent) {
  if (!parent) {
    return '<p class="submap-initial-revision">Initial revision</p>'
  }
  const difference = compareSubmapRevisions(submap, parent)
  return `
    <section class="submap-revision-diff">
      <h3>Changes from r${escapeHtml(parent.revision)}</h3>
      <div class="submap-diff-counts">
        ${diffCount(difference.addedNodes.length, 'nodes', 'added')}
        ${diffCount(difference.removedNodes.length, 'nodes', 'removed')}
        ${diffCount(difference.addedEdges.length, 'edges', 'added')}
        ${diffCount(difference.removedEdges.length, 'edges', 'removed')}
      </div>
      ${changedNodesHtml(difference)}
    </section>
  `
}

function revisionButton(revision, activeUid) {
  const active = revision.uid === activeUid
  return `<button class="revision-chip${active ? ' active' : ''}" data-submap-revision-uid="${escapeHtml(
    revision.uid
  )}"${active ? ' aria-current="true"' : ''}>r${escapeHtml(revision.revision)}</button>`
}

function diffCount(count, subject, change) {
  const sign = change === 'added' ? '+' : '−'
  return `<span class="${change}">${sign}${escapeHtml(count)} ${subject}</span>`
}

function changedNodesHtml({ addedNodes, removedNodes }) {
  const changes = [
    ...addedNodes.map((node) => ['+', 'added', node]),
    ...removedNodes.map((node) => ['−', 'removed', node])
  ].slice(0, 10)
  return changes.length
    ? `<div class="submap-node-changes">${changes.map(([sign, type, node]) => changedNode(sign, type, node)).join('')}</div>`
    : ''
}

function changedNode(sign, type, node) {
  return `<span class="${type}"><b>${sign}</b>${escapeHtml(node.label ?? node.id)}</span>`
}

function previewStat(value, label) {
  return `<span><strong>${escapeHtml(value)}</strong><small>${label}</small></span>`
}

function previewNode(node) {
  return `<div class="submap-preview-node"><strong>${escapeHtml(node.label ?? node.id)}</strong><small>${escapeHtml(
    node.type ?? node.layer ?? 'node'
  )}</small></div>`
}
