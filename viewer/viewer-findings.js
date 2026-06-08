function initializeFindingsFilters() {
  const findings = state.graph?.findings ?? []
  const modules = ['all', ...unique(findings.map(finding => nodeForFinding(finding)?.module))
    .sort((a, b) => formatModule(a).localeCompare(formatModule(b), undefined, { sensitivity: 'base' }))]
  const rules = ['all', ...unique(findings.map(finding => finding.ruleId)).sort()]
  const severities = ['all', ...unique(findings.map(finding => finding.severity)).sort()]

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

  return (state.graph.findings ?? []).filter(finding => {
    const node = nodeForFinding(finding)
    if (severity !== 'all' && finding.severity !== severity) return false
    if (rule !== 'all' && finding.ruleId !== rule) return false
    if (module !== 'all' && node?.module !== module) return false
    if (!query) return true
    return [
      finding.ruleId,
      finding.severity,
      finding.category,
      finding.path,
      finding.message,
      finding.evidence,
      node?.label,
      node?.module
    ].filter(Boolean).some(value => String(value).toLowerCase().includes(query))
  })
}

function renderFindingsTable(findings) {
  if (findings.length === 0) {
    els.findingsTable.innerHTML = '<div class="p-6 text-sm text-gray-400">No findings match the current filters.</div>'
    return
  }

  els.findingsTable.innerHTML = findings.map(finding => {
    const node = nodeForFinding(finding)
    const severityClass = finding.severity === 'error'
      ? 'bg-red-50 text-red-700 border border-red-100'
      : 'bg-amber-50 text-amber-700 border border-amber-100'
    const path = finding.path ?? finding.nodeId ?? ''
    const shortPath = path.split(/[\\/]/).slice(-2).join('/')
    return `
      <div class="finding-row w-full text-left p-3">
        <div class="font-semibold text-sm leading-tight">${escapeHtml(formatRuleId(finding.ruleId))}</div>
        <div class="text-xs text-gray-500 mt-0.5">${escapeHtml(finding.message)}</div>
        <div class="mt-2 flex flex-wrap gap-1">
          ${pillHtml(severityClass, capitalize(finding.severity))}
          ${pillHtml('bg-blue-50 text-blue-700 border border-blue-100', capitalize(finding.category) || 'Architecture')}
          ${pillHtml('bg-gray-50 text-gray-600 border border-gray-100', formatModule(node?.module ?? 'shared'))}
        </div>
        <div class="text-[11px] text-gray-400 mt-1.5 truncate">
          <button onclick="navigator.clipboard.writeText('${escapeHtml(path)}').then(()=>showToast('Path copied'))" class="bg-transparent border-0 cursor-pointer p-0 text-gray-400 hover:text-gray-700 text-[11px]" title="Copy path">${escapeHtml(shortPath)}${finding.line ? `:${finding.line}` : ''}</button>
        </div>
      </div>
    `
  }).join('')
}

function nodeForFinding(finding) {
  return state.graph.nodes.find(node => node.id === finding.nodeId)
}
