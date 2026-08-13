import { els, state } from '#viewer/viewer-state.js'
import { escapeHtml, formatModule, formatRuleId, formatType } from '#viewer/viewer-utils.js'

function showPopover(event, id) {
  const node = state.graph.nodes.find((item) => item.id === id)
  if (!node || !hasPopoverDetails(node)) {
    return
  }
  const quality = node.meta?.quality
  const findings = node.meta?.findings ?? []
  els.popover.innerHTML = `
    <strong>${escapeHtml(node.label)}</strong>
    ${findingSummary(findings)}
    ${reviewSummary(node.meta?.review)}
    ${coverageSummary(node.meta?.coverage)}
    ${qualitySummary(quality)}
  `
  els.popover.style.display = 'block'
  movePopover(event)
}

function hasPopoverDetails(node) {
  return Boolean(
    node.meta?.quality || node.meta?.coverage?.hasCoverage || node.meta?.review || node.meta?.findings?.length
  )
}

function findingSummary(findings) {
  if (!findings.length) {
    return ''
  }
  const labels = findings.map((finding) => {
    return `${escapeHtml(formatRuleId(finding.ruleId))} (${escapeHtml(finding.severity)})`
  })
  return `<div class="metric-line"><b>Findings</b>: ${labels.join(', ')}</div>`
}

function reviewSummary(review) {
  return review ? `<div class="metric-line"><b>Needs review</b>: ${escapeHtml(review.reason)}</div>` : ''
}

function coverageSummary(coverage) {
  if (!coverage?.hasCoverage) {
    return ''
  }
  return `<div class="metric-line"><b>Coverage</b>: ${coverage.tests.map(escapeHtml).join(', ')}</div>`
}

function qualitySummary(quality) {
  if (!quality) {
    return ''
  }
  const components = internalComponents(quality)
  return `
    <div class="metric-line"><b>Score ${quality.score}/10</b>: ${escapeHtml(quality.summary ?? 'Combined cohesion and coupling score')}</div>
    <div class="metric-line"><b>Cohesion ${quality.cohesion.score}/10</b>: ${escapeHtml(quality.cohesion.reason)}</div>
    <div class="metric-line"><b>Coupling ${quality.coupling.score}/10</b>: ${escapeHtml(quality.coupling.reason)}</div>
    ${components ? `<div class="related"><b>Internal components</b><br />${components}</div>` : ''}
    <div class="related"><b>Related</b><br />${relatedNodes(quality)}</div>
  `
}

function internalComponents(quality) {
  if (!quality.internalComponents?.length) {
    return ''
  }
  return quality.internalComponents
    .map((component) => {
      const summary = escapeHtml(component.summary ?? 'Supporting component score')
      return `${escapeHtml(component.label)}: ${component.score}/10 - ${summary}`
    })
    .join('<br />')
}

function relatedNodes(quality) {
  if (!quality.related?.length) {
    return 'No notable relations'
  }
  return quality.related
    .map((item) => {
      return `${escapeHtml(item.label)} (${escapeHtml(formatType(item.type))}, ${escapeHtml(formatModule(item.module))})`
    })
    .join('<br />')
}

function movePopover(event) {
  const offset = 14
  const width = els.popover.offsetWidth || 360
  const height = els.popover.offsetHeight || 160
  const left = Math.min(window.innerWidth - width - 12, event.clientX + offset)
  const top = Math.min(window.innerHeight - height - 12, event.clientY + offset)
  els.popover.style.left = `${Math.max(12, left)}px`
  els.popover.style.top = `${Math.max(12, top)}px`
}

function hidePopover() {
  els.popover.style.display = 'none'
}

export { hidePopover, movePopover, showPopover }
