import { escapeHtml } from '#viewer/viewer-utils.js'

export function renderReportSummary(report, graph, elements) {
  elements.projectName.textContent = graph.projectMap?.project?.name ?? 'Architecture explorer'
  elements.metricModules.textContent = report.moduleCount.toLocaleString()
  elements.metricNodes.textContent = report.stats.nodes.toLocaleString()
  elements.metricEdges.textContent = report.stats.edges.toLocaleString()
  elements.metricFindings.textContent = report.findings.length.toLocaleString()
  elements.metricFindings.classList.toggle('text-red-700', report.findings.length > 0)
  elements.metricCoverage.textContent = report.coveragePercent === null ? 'N/A' : `${report.coveragePercent}%`
  elements.sidebarFindingsCount.textContent = report.findings.length.toLocaleString()
  elements.statsPopover.innerHTML = reportPopoverHtml(report)
  elements.metaPill.querySelector('span:last-child').textContent = `Updated ${report.timeAgo}`
}

export function reportPopoverHtml(report) {
  const date = report.generated.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  const time = report.generated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return `
    <p class="text-xs font-semibold uppercase text-gray-400 tracking-wide mb-3">Report · ${date} ${time}</p>
    <div class="space-y-2">${reportRows(report)}</div>
    <div class="mt-3 pt-3 border-t border-gray-100 space-y-1">
      <p class="text-[11px] font-semibold uppercase text-gray-400">Finding origin</p>
      ${scopeRow('Technology', report.scopes.technology ?? 0)}${scopeRow('Framework', report.scopes.framework ?? 0)}${scopeRow('Repo custom', report.scopes.repo ?? 0)}
    </div>
    ${reportList('Active templates', report.templates.map(escapeHtml).join(', ') || 'None')}
    ${reportList('Architecture', report.architecture.map((item) => escapeHtml(item.label ?? item.id)).join(', ') || 'None')}
    <p class="text-[11px] text-gray-300 mt-3">Generated ${report.timeAgo}</p>`
}

function reportRows(report) {
  return [
    ['Components', report.stats.nodes, ''],
    ['Relations', report.stats.edges, ''],
    ['Orphans', report.stats.orphans, report.stats.orphans > 0 ? 'text-amber-600' : ''],
    ['Skipped large files', report.stats.skippedFiles ?? 0, report.stats.skippedFiles > 0 ? 'text-amber-600' : ''],
    ['No coverage', `${report.uncovered} / ${report.coverable}`, report.uncovered > 0 ? 'text-orange-600' : ''],
    ['Findings', report.findings.length, report.findings.length > 0 ? 'text-red-600' : ''],
    ['Suppressed', report.suppressed.length, report.suppressed.length > 0 ? 'text-gray-600' : ''],
    ['Templates', report.templates.length, ''],
    ['Architectures', report.architecture.length, '']
  ]
    .map(([label, value, className]) => reportRow(label, value, className))
    .join('')
}

function reportRow(label, value, className) {
  return `<div class="flex justify-between"><span class="text-gray-500">${label}</span><span class="font-semibold ${className}">${value.toLocaleString?.() ?? value}</span></div>`
}

function scopeRow(label, value) {
  return `<div class="flex justify-between"><span class="text-gray-500">${label}</span><span>${value}</span></div>`
}

function reportList(label, value) {
  return `
    <div class="mt-3 pt-3 border-t border-gray-100">
      <p class="text-[11px] font-semibold uppercase text-gray-400 mb-1">${label}</p>
      <p class="text-[11px] text-gray-500 leading-4">${value}</p>
    </div>
  `
}
