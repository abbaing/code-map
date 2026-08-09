import { els, state } from '#viewer/viewer-state.js'
import {
  capitalize,
  escapeHtml,
  fillSelect,
  formatModule,
  formatRuleId,
  pillHtml,
  unique
} from '#viewer/viewer-utils.js'

function initializeFindingsFilters() {
  const findings = state.graph?.findings ?? []
  const modules = [
    'all',
    ...unique(findings.map((finding) => nodeForFinding(finding)?.module)).sort((a, b) =>
      formatModule(a).localeCompare(formatModule(b), undefined, { sensitivity: 'base' })
    )
  ]
  const rules = ['all', ...unique(findings.map((finding) => finding.ruleId)).sort()]
  const severities = ['all', ...unique(findings.map((finding) => finding.severity)).sort()]

  fillSelect(els.findingsModule, modules, 'All modules', formatModule)
  fillSelect(els.findingsRule, rules, 'All rules', formatRuleId)
  fillSelect(els.findingsSeverity, severities, 'All severities', capitalize)
}

function renderFindings() {
  const findings = filteredFindings()
  renderFindingsTable(findings)
}

function filteredFindings() {
  const query = els.findingsSearch.value.trim().toLowerCase()
  const severity = els.findingsSeverity.value
  const rule = els.findingsRule.value
  const module = els.findingsModule.value

  return (state.graph.findings ?? []).filter((finding) => {
    const node = nodeForFinding(finding)
    if (severity !== 'all' && finding.severity !== severity) {
      return false
    }
    if (rule !== 'all' && finding.ruleId !== rule) {
      return false
    }
    if (module !== 'all' && node?.module !== module) {
      return false
    }
    if (!query) {
      return true
    }
    return [
      finding.ruleId,
      finding.severity,
      finding.category,
      finding.path,
      finding.message,
      finding.evidence,
      node?.label,
      node?.module
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  })
}

function renderFindingsTable(findings) {
  if (findings.length === 0) {
    els.findingsTable.innerHTML = '<div class="p-6 text-sm text-gray-400">No findings match the current filters.</div>'
    return
  }

  const rows = findings
    .map((finding) => {
      const node = nodeForFinding(finding)
      const severityClass =
        finding.severity === 'error'
          ? 'bg-red-50 text-red-700 border border-red-100'
          : 'bg-amber-50 text-amber-700 border border-amber-100'
      const path = finding.path ?? finding.nodeId ?? ''
      const shortPath = path.split(/[\\/]/).slice(-2).join('/')
      return `
      <div class="finding-row">
        <div class="finding-description">
          <strong>${escapeHtml(formatRuleId(finding.ruleId))}</strong>
          <span>${escapeHtml(finding.message)}</span>
        </div>
        <div>${pillHtml(severityClass, capitalize(finding.severity))}</div>
        <div class="finding-module">${escapeHtml(formatModule(node?.module ?? 'shared'))}</div>
        <div class="finding-path">
          <button data-copy-path="${escapeHtml(path)}" title="Copy path">${escapeHtml(shortPath)}${finding.line ? `:${finding.line}` : ''}</button>
        </div>
      </div>
    `
    })
    .join('')

  els.findingsTable.innerHTML = `
    <div class="findings-table-head" aria-hidden="true">
      <span>Finding</span><span>Severity</span><span>Module</span><span>Location</span>
    </div>
    ${rows}
  `
}

function nodeForFinding(finding) {
  return state.graph.nodes.find((node) => node.id === finding.nodeId)
}

export { initializeFindingsFilters, renderFindings, renderFindingsTable }
