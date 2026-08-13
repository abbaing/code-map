import { isCoverable } from '#viewer/viewer-data.js'
import { escapeHtml, formatRuleId } from '#viewer/viewer-utils.js'

function coverageDetail(node) {
  const coverage = node.meta?.coverage
  if (!coverage?.hasCoverage) {
    return isCoverable(node) ? '<div><strong>Coverage</strong><br />No test found</div>' : ''
  }
  return `<div><strong>Coverage</strong><br />${coverage.tests.map(escapeHtml).join('<br />')}</div>`
}

function reviewDetail(node) {
  const review = node.meta?.review
  if (!review) {
    return ''
  }
  return `<div><strong>Needs review</strong><br />${escapeHtml(review.reason)}</div>`
}

function findingsDetail(node) {
  const findings = node.meta?.findings
  if (!findings?.length) {
    return ''
  }
  return `<div><strong>Findings</strong><div class="mt-1 space-y-1">${findings.map(findingDetail).join('')}</div></div>`
}

function findingDetail(finding) {
  const metadata = [
    finding.severity,
    finding.category,
    finding.confidence ? `${finding.confidence} confidence` : null,
    finding.effort ? `${finding.effort} effort` : null
  ].filter(Boolean)
  return `
    <div class="border border-red-100 bg-red-50 rounded px-2 py-1.5">
      <div class="font-semibold text-red-800">${escapeHtml(formatRuleId(finding.ruleId))}${finding.line ? `:${finding.line}` : ''}</div>
      <div class="text-xs text-red-700 mb-1">${escapeHtml(metadata.join(' · '))}</div>
      <div>${escapeHtml(finding.message)}</div>
      ${finding.why ? `<div class="text-xs text-red-900 mt-1"><strong>Why</strong>: ${escapeHtml(finding.why)}</div>` : ''}
      ${finding.fixHint ? `<div class="text-xs text-red-900 mt-1"><strong>Fix</strong>: ${escapeHtml(finding.fixHint)}</div>` : ''}
      ${finding.evidence ? `<div class="text-xs text-red-700 mt-1">${escapeHtml(finding.evidence)}</div>` : ''}
      ${finding.docsPath ? `<div class="text-xs text-red-700 mt-1">${escapeHtml(finding.docsPath)}</div>` : ''}
    </div>
  `
}

function qualityDetail(node) {
  const quality = node.meta?.quality
  if (!quality) {
    return ''
  }
  return `
    <div>
      <strong>Quality</strong><br />
      Score: ${quality.score}/10<br />
      Cohesion: ${quality.cohesion.score}/10<br />
      Coupling: ${quality.coupling.score}/10
      ${internalComponentQualityDetail(quality)}
    </div>
  `
}

function internalComponentQualityDetail(quality) {
  if (!quality.internalComponents?.length) {
    return ''
  }
  const components = quality.internalComponents.map(
    (component) => `
    <div class="mt-1">
      ${escapeHtml(component.label)}: ${component.score}/10<br />
      <span class="text-gray-500">${escapeHtml(component.summary ?? 'Supporting component score')}</span>
    </div>
  `
  )
  return `<div class="mt-2"><strong>Internal components</strong><br />${components.join('')}</div>`
}

export { coverageDetail, findingsDetail, qualityDetail, reviewDetail }
