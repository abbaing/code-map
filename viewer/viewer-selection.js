function selectNode(id) {
  state.selectedId = id
  hidePopover()
  if (state.view === 'graph' || state.view === 'domain') render()
  renderModuleDetail()
}

function clearSelectedNode() {
  const hadSelection = Boolean(state.selectedId)
  state.selectedId = null
  hidePopover()
  if (hadSelection && (state.view === 'graph' || state.view === 'domain')) render()
  if (hadSelection) renderModuleDetail()
}

function coverageDetail(node) {
  const coverage = node.meta?.coverage
  if (!coverage?.hasCoverage) {
    return isCoverable(node) ? '<div><strong>Coverage</strong><br />No test found</div>' : ''
  }
  return `
    <div>
      <strong>Coverage</strong><br />
      ${coverage.tests.map(test => escapeHtml(test)).join('<br />')}
    </div>
  `
}

function reviewDetail(node) {
  const review = node.meta?.review
  if (!review) return ''
  return `
    <div>
      <strong>Needs review</strong><br />
      ${escapeHtml(review.reason)}
    </div>
  `
}

function findingsDetail(node) {
  const findings = node.meta?.findings
  if (!findings?.length) return ''
  return `
    <div>
      <strong>Findings</strong>
      <div class="mt-1 space-y-1">
        ${findings.map(finding => `
          <div class="border border-red-100 bg-red-50 rounded px-2 py-1.5">
            <div class="font-semibold text-red-800">${escapeHtml(formatRuleId(finding.ruleId))}${finding.line ? `:${finding.line}` : ''}</div>
            <div class="text-xs text-red-700 mb-1">${escapeHtml([finding.severity, finding.category, finding.confidence ? `${finding.confidence} confidence` : null, finding.effort ? `${finding.effort} effort` : null].filter(Boolean).join(' · '))}</div>
            <div>${escapeHtml(finding.message)}</div>
            ${finding.why ? `<div class="text-xs text-red-900 mt-1"><strong>Why</strong>: ${escapeHtml(finding.why)}</div>` : ''}
            ${finding.fixHint ? `<div class="text-xs text-red-900 mt-1"><strong>Fix</strong>: ${escapeHtml(finding.fixHint)}</div>` : ''}
            ${finding.evidence ? `<div class="text-xs text-red-700 mt-1">${escapeHtml(finding.evidence)}</div>` : ''}
            ${finding.docsPath ? `<div class="text-xs text-red-700 mt-1">${escapeHtml(finding.docsPath)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `
}

function qualityDetail(node) {
  const quality = node.meta?.quality
  if (!quality) return ''
  const internalComponents = internalComponentQualityDetail(quality)
  return `
    <div>
      <strong>Quality</strong><br />
      Score: ${quality.score}/10<br />
      Cohesion: ${quality.cohesion.score}/10<br />
      Coupling: ${quality.coupling.score}/10
      ${internalComponents}
    </div>
  `
}

function internalComponentQualityDetail(quality) {
  if (!quality.internalComponents?.length) return ''
  return `
    <div class="mt-2">
      <strong>Internal components</strong><br />
      ${quality.internalComponents.map(component => `
        <div class="mt-1">
          ${escapeHtml(component.label)}: ${component.score}/10<br />
          <span class="text-gray-500">${escapeHtml(component.summary ?? 'Collapsed internal component score')}</span>
        </div>
      `).join('')}
    </div>
  `
}

function showPopover(event, id) {
  const node = state.graph.nodes.find(item => item.id === id)
  const quality = node?.meta?.quality
  if (!node) return
  const coverage = node.meta?.coverage
  const review = node.meta?.review
  const findings = node.meta?.findings ?? []
  if (!quality && !coverage?.hasCoverage && !review && findings.length === 0) return
  const related = quality?.related?.length
    ? quality.related.map(item => `${escapeHtml(item.label)} (${escapeHtml(formatType(item.type))}, ${escapeHtml(formatModule(item.module))})`).join('<br />')
    : 'No notable relations'
  const internalComponents = quality?.internalComponents?.length
    ? quality.internalComponents
      .map(component => `${escapeHtml(component.label)}: ${component.score}/10 - ${escapeHtml(component.summary ?? 'Collapsed internal component score')}`)
      .join('<br />')
    : ''

  els.popover.innerHTML = `
    <strong>${escapeHtml(node.label)}</strong>
    ${findings.length ? `<div class="metric-line"><b>Findings</b>: ${findings.map(finding => `${escapeHtml(formatRuleId(finding.ruleId))} (${escapeHtml(finding.severity)})`).join(', ')}</div>` : ''}
    ${review ? `<div class="metric-line"><b>Needs review</b>: ${escapeHtml(review.reason)}</div>` : ''}
    ${coverage?.hasCoverage ? `<div class="metric-line"><b>Coverage</b>: ${coverage.tests.map(test => escapeHtml(test)).join(', ')}</div>` : ''}
    ${quality ? `<div class="metric-line"><b>Score ${quality.score}/10</b>: ${escapeHtml(quality.summary ?? 'Combined cohesion and coupling score')}</div>
    <div class="metric-line"><b>Cohesion ${quality.cohesion.score}/10</b>: ${escapeHtml(quality.cohesion.reason)}</div>
    <div class="metric-line"><b>Coupling ${quality.coupling.score}/10</b>: ${escapeHtml(quality.coupling.reason)}</div>
    ${internalComponents ? `<div class="related"><b>Internal components</b><br />${internalComponents}</div>` : ''}
    <div class="related"><b>Related</b><br />${related}</div>` : ''}
  `
  els.popover.style.display = 'block'
  movePopover(event)
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

function selectedNodeDetailHtml(node) {
  const quality = node.meta?.quality
  const coverage = node.meta?.coverage
  const review = node.meta?.review
  const findings = node.meta?.findings ?? []
  const nodeType = formatType(node.type)
  const nodeModule = formatModule(node.module)
  const coverageTests = coverage?.tests ?? []
  const testCaseCount = typeof coverage?.testCaseCount === 'number' ? coverage.testCaseCount : null
  const coverageTitle = coverageTests.length
    ? `Covered by ${coverageTests.length} test file${coverageTests.length === 1 ? '' : 's'}: ${coverageTests.join(', ')}`
    : 'Linked test found'
  const coverageLabel = testCaseCount === null
    ? 'Has tests'
    : `${testCaseCount} test case${testCaseCount === 1 ? '' : 's'}`

  return `
    <div class="space-y-2.5">
      <div>
        <div class="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Selected component</div>
        <div class="mt-0.5 text-sm font-semibold leading-snug text-gray-900 break-words">${escapeHtml(node.label)}</div>
      </div>
      <div class="flex flex-nowrap gap-1 overflow-x-auto pb-0.5">
        ${pillHtml('bg-sky-50 text-sky-700 border border-sky-100 whitespace-nowrap shrink-0', nodeType)}
        ${pillHtml('bg-gray-50 text-gray-700 border border-gray-100 whitespace-nowrap shrink-0', nodeModule)}
        ${coverage?.hasCoverage ? pillHtml('bg-amber-50 text-amber-700 border border-amber-100 whitespace-nowrap shrink-0', coverageLabel, coverageTitle) : ''}
        ${review ? pillHtml('bg-red-50 text-red-700 border border-red-100 whitespace-nowrap shrink-0', 'Needs review') : ''}
        ${findings.length ? pillHtml('bg-red-50 text-red-700 border border-red-100 whitespace-nowrap shrink-0', `${findings.length} finding${findings.length === 1 ? '' : 's'}`) : ''}
      </div>
      ${node.path ? `
        <div>
          <div class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Path</div>
          <div class="rounded border border-gray-200 bg-gray-50 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-gray-700 break-all">${escapeHtml(node.path)}</div>
        </div>
      ` : ''}
    </div>
    <div class="mt-3 space-y-2 text-[11px]">
      ${quality ? qualitySummaryHtml(quality) : ''}
      ${review ? `<div class="bg-red-50 border border-red-100 rounded px-2 py-1.5 text-red-800"><div class="font-semibold">Needs review</div>${escapeHtml(review.reason)}</div>` : ''}
      ${findings.length ? `<div><div class="font-semibold text-gray-700 mb-1">Findings</div>${findings.map(finding => `<div class="bg-red-50 border border-red-100 rounded px-2 py-1.5 mb-1 text-red-800">${escapeHtml(formatRuleId(finding.ruleId))}${finding.line ? `:${finding.line}` : ''}<div class="text-red-700">${escapeHtml(finding.message)}</div></div>`).join('')}</div>` : ''}
      ${coverage?.hasCoverage ? coverageSummaryHtml(testCaseCount) : ''}
    </div>
  `
}

function coverageSummaryHtml(testCaseCount) {
  return `
    <div class="rounded border border-gray-200 bg-white p-2">
      <div class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Coverage</div>
      <div class="flex items-baseline justify-between gap-2">
        <div class="text-gray-500">Test cases</div>
        <div class="text-sm font-semibold text-gray-800">${testCaseCount === null ? 'Refresh' : escapeHtml(testCaseCount)}</div>
      </div>
    </div>
  `
}

function qualitySummaryHtml(quality) {
  const health = healthPill(quality.score)
  const qualityColor = scoreColor(quality.score)
  return `
    <div class="rounded border border-gray-200 bg-white p-2">
      <div class="mb-2 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Quality</div>
        </div>
        <span class="text-[11px] font-semibold rounded px-2 py-0.5 text-white whitespace-nowrap shrink-0" style="background:${qualityColor}" title="${escapeHtml(health.description)}" aria-label="${escapeHtml(health.description)}">Q ${escapeHtml(quality.score)}/10</span>
      </div>
      <div class="space-y-2">
        ${qualityMetricHtml('Overall', quality.score, quality.summary ?? health.description, 'bg-emerald-300')}
        ${qualityMetricHtml('Cohesion', quality.cohesion.score, quality.cohesion.reason, 'bg-sky-300')}
        ${qualityMetricHtml('Coupling', quality.coupling.score, quality.coupling.reason, 'bg-violet-300')}
      </div>
    </div>
  `
}

function qualityMetricHtml(label, score, title, barClassName) {
  const pct = Math.max(0, Math.min(100, Number(score) * 10))
  return `
    <div class="text-gray-700" title="${escapeHtml(title ?? '')}" aria-label="${escapeHtml(title ?? '')}">
      <div class="mb-1 flex items-center justify-between gap-2">
        <div class="font-semibold">${escapeHtml(label)}</div>
        <div class="font-semibold">${escapeHtml(score)}/10</div>
      </div>
      <div class="h-1.5 rounded bg-gray-100">
        <div class="h-1.5 rounded ${barClassName}" style="width:${pct}%"></div>
      </div>
    </div>
  `
}


function edgeLine(edge) {
  const otherId = edge.from === state.selectedId ? edge.to : edge.from
  const other = state.graph.nodes.find(node => node.id === otherId)
  return `<div class="border border-gray-200 rounded px-2 py-1.5 cursor-pointer hover:border-blue-400 text-sm" data-pick="${escapeHtml(otherId)}"><strong class="block">${escapeHtml(edge.label)}</strong><span class="text-gray-500 text-xs">${escapeHtml(other?.label ?? otherId)}</span></div>`
}

function connectedEdgeIds(nodeId) {
  if (!nodeId) return new Set()
  return new Set(state.graph.edges.filter(edge => edge.from === nodeId || edge.to === nodeId).map(edge => edge.id))
}
