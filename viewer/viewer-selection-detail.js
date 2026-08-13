import { state } from '#viewer/viewer-state.js'
import { escapeHtml, formatModule, formatRuleId, formatType, pillHtml } from '#viewer/viewer-utils.js'
import { coverageSummaryHtml, qualitySummaryHtml, traceSummaryHtml } from '#viewer/viewer-selection-summary.js'

function selectedNodeDetailHtml(node) {
  const detail = buildDetailContext(node)
  return `
    <div class="space-y-2.5">
      <div>
        <div class="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Selected component</div>
        <div class="mt-0.5 text-sm font-semibold leading-snug text-gray-900 break-words">${escapeHtml(node.label)}</div>
      </div>
      <div class="flex flex-nowrap gap-1 overflow-x-auto pb-0.5">
        ${pillHtml('bg-sky-50 text-sky-700 border border-sky-100 whitespace-nowrap shrink-0', formatType(node.type))}
        ${pillHtml('bg-gray-50 text-gray-700 border border-gray-100 whitespace-nowrap shrink-0', formatModule(node.module))}
        ${coveragePill(detail.coverage, detail.testCaseCount, detail.coverageTitle)}
        ${reviewPill(detail.review)}
        ${findingsPill(detail.findings)}
      </div>
      ${pathDetail(node.path)}
    </div>
    ${traceSummaryHtml(state.trace)}
    <div class="mt-3 space-y-2 text-[11px]">
      ${qualitySummary(detail.quality)}
      ${reviewDetail(detail.review)}
      ${findingsSummary(detail.findings)}
      ${coverageSummary(detail.coverage, detail.testCaseCount)}
    </div>
  `
}

function buildDetailContext(node) {
  const coverage = node.meta?.coverage
  const coverageTests = coverage?.tests ?? []
  const testCaseCount = typeof coverage?.testCaseCount === 'number' ? coverage.testCaseCount : null
  const fileLabel = coverageTests.length === 1 ? 'file' : 'files'
  const coverageTitle = coverageTests.length
    ? `Covered by ${coverageTests.length} test ${fileLabel}: ${coverageTests.join(', ')}`
    : 'Linked test found'
  return {
    coverage,
    coverageTitle,
    findings: node.meta?.findings ?? [],
    quality: node.meta?.quality,
    review: node.meta?.review,
    testCaseCount
  }
}

function reviewPill(review) {
  return review
    ? pillHtml('bg-red-50 text-red-700 border border-red-100 whitespace-nowrap shrink-0', 'Needs review')
    : ''
}

function qualitySummary(quality) {
  return quality ? qualitySummaryHtml(quality) : ''
}

function coverageSummary(coverage, testCaseCount) {
  return coverage?.hasCoverage ? coverageSummaryHtml(testCaseCount) : ''
}

function coveragePill(coverage, count, title) {
  if (!coverage?.hasCoverage) {
    return ''
  }
  const label = count === null ? 'Has tests' : `${count} test case${count === 1 ? '' : 's'}`
  return pillHtml('bg-amber-50 text-amber-700 border border-amber-100 whitespace-nowrap shrink-0', label, title)
}

function findingsPill(findings) {
  if (!findings.length) {
    return ''
  }
  const label = `${findings.length} finding${findings.length === 1 ? '' : 's'}`
  return pillHtml('bg-red-50 text-red-700 border border-red-100 whitespace-nowrap shrink-0', label)
}

function pathDetail(path) {
  if (!path) {
    return ''
  }
  return `
    <div>
      <div class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Path</div>
      <div class="rounded border border-gray-200 bg-gray-50 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-gray-700 break-all">${escapeHtml(path)}</div>
    </div>
  `
}

function reviewDetail(review) {
  if (!review) {
    return ''
  }
  return `<div class="bg-red-50 border border-red-100 rounded px-2 py-1.5 text-red-800"><div class="font-semibold">Needs review</div>${escapeHtml(review.reason)}</div>`
}

function findingsSummary(findings) {
  if (!findings.length) {
    return ''
  }
  const rows = findings.map(
    (finding) => `
    <div class="bg-red-50 border border-red-100 rounded px-2 py-1.5 mb-1 text-red-800">
      ${escapeHtml(formatRuleId(finding.ruleId))}${finding.line ? `:${finding.line}` : ''}
      <div class="text-red-700">${escapeHtml(finding.message)}</div>
    </div>
  `
  )
  return `<div><div class="font-semibold text-gray-700 mb-1">Findings</div>${rows.join('')}</div>`
}

function edgeLine(edge) {
  const otherId = edge.from === state.selectedId ? edge.to : edge.from
  const other = state.graph.nodes.find((node) => node.id === otherId)
  const provenance = [edge.confidence ? `${edge.confidence} confidence` : null, edge.source, edge.evidence]
    .filter(Boolean)
    .join(' · ')
  return `
    <div class="border border-gray-200 rounded px-2 py-1.5 cursor-pointer hover:border-blue-400 text-sm" data-pick="${escapeHtml(otherId)}">
      <strong class="block">${escapeHtml(edge.label)}</strong>
      <span class="text-gray-500 text-xs block">${escapeHtml(other?.label ?? otherId)}</span>
      ${provenance ? `<span class="text-gray-400 text-xs block break-words">${escapeHtml(provenance)}</span>` : ''}
    </div>
  `
}

export { edgeLine, selectedNodeDetailHtml }
