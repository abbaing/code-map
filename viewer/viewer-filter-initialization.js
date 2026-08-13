import { requireViewOperations } from '#viewer/viewer-data-context.js'
import { isCoverable } from '#viewer/viewer-filters.js'
import { applyProjectMap } from '#viewer/viewer-project-map-presentation.js'
import { els, state } from '#viewer/viewer-state.js'
import { escapeHtml, formatType, healthDescription, unique } from '#viewer/viewer-utils.js'

const healthLevels = [
  ['excellent', 'Excellent', 'text-emerald-700'],
  ['very-good', 'Very good', 'text-emerald-600'],
  ['good', 'Good', 'text-blue-700'],
  ['fair', 'Fair', 'text-amber-700'],
  ['low', 'Low', 'text-orange-700'],
  ['critical', 'Critical', 'text-red-700']
]

export function initializeFilters() {
  applyProjectMap(state.graph.projectMap)
  requireViewOperations().initializeFindingsFilters()
  initializeHealthFilters()
  initializeTypeFilters()
  renderCounts()
  renderReportSummary()
}

function initializeHealthFilters() {
  state.selectedHealth = new Set(healthLevels.map(([key]) => key))
  els.healthChecks.innerHTML = ''
  for (const [key, label, className] of healthLevels) {
    const element = document.createElement('label')
    element.className = 'flex items-center gap-2 text-sm'
    element.title = healthDescription(key)
    element.innerHTML = `<input type="checkbox" checked data-health="${escapeHtml(key)}" />
      <span class="flex-1 font-medium ${className}" title="${escapeHtml(healthDescription(key))}">${escapeHtml(label)}</span>`
    els.healthChecks.appendChild(element)
  }
}

function initializeTypeFilters() {
  const types = unique(state.graph.nodes.map((node) => node.type)).sort()
  const hidden = new Set(['config', 'controller'])
  state.selectedTypes = new Set(types.filter((type) => !hidden.has(type)))
  els.typeChecks.innerHTML = ''
  for (const type of types) {
    const count = state.graph.nodes.filter((node) => node.type === type).length
    const element = document.createElement('label')
    element.className = 'flex items-center gap-2 text-sm'
    element.innerHTML = `<input type="checkbox" ${hidden.has(type) ? '' : 'checked'} data-type="${escapeHtml(type)}" />
      <span class="flex-1">${escapeHtml(formatType(type))}</span><span class="text-xs text-gray-400">${count}</span>`
    els.typeChecks.appendChild(element)
  }
}

function renderCounts() {
  const nodes = state.graph.nodes
  const uncovered = nodes.filter((node) => isCoverable(node) && !node.meta?.coverage?.hasCoverage)
  els.orphanCount.textContent = String(state.graph.orphans.length)
  els.uncoveredCount.textContent = String(uncovered.length)
  els.reviewCount.textContent = String(nodes.filter((node) => node.meta?.review).length)
  els.findingsCount.textContent = String(nodes.filter((node) => node.meta?.findings?.length).length)
}

function renderReportSummary() {
  const report = reportModel()
  els.projectName.textContent = state.graph.projectMap?.project?.name ?? 'Architecture explorer'
  els.metricModules.textContent = report.moduleCount.toLocaleString()
  els.metricNodes.textContent = report.stats.nodes.toLocaleString()
  els.metricEdges.textContent = report.stats.edges.toLocaleString()
  els.metricFindings.textContent = report.findings.length.toLocaleString()
  els.metricFindings.classList.toggle('text-red-700', report.findings.length > 0)
  els.metricCoverage.textContent = report.coveragePercent === null ? 'N/A' : `${report.coveragePercent}%`
  els.sidebarFindingsCount.textContent = report.findings.length.toLocaleString()
  els.statsPopover.innerHTML = reportPopoverHtml(report)
  els.metaPill.querySelector('span:last-child').textContent = `Updated ${report.timeAgo}`
}

function reportModel() {
  const { nodes, stats, generatedAt } = state.graph
  const coverable = nodes.filter(isCoverable)
  const covered = coverable.filter((node) => node.meta?.coverage?.hasCoverage)
  const findings = state.graph.findings ?? []
  return {
    stats,
    findings,
    generated: new Date(generatedAt),
    timeAgo: formatTimeAgo(new Date(generatedAt)),
    moduleCount: unique(nodes.map((node) => node.module || 'shared')).length,
    coverable: coverable.length,
    uncovered: coverable.length - covered.length,
    coveragePercent: coverable.length ? Math.round((covered.length / coverable.length) * 100) : null,
    suppressed: state.graph.suppressedFindings ?? [],
    templates: state.graph.templates ?? [],
    architecture: state.graph.architecture ?? [],
    scopes: findingScopes(findings)
  }
}

function reportPopoverHtml(report) {
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

function findingScopes(findings) {
  return findings.reduce((scopes, finding) => {
    const scope = ['repo', 'framework', 'technology'].find((name) => finding.ruleId?.startsWith(`${name}.`)) ?? 'other'
    scopes[scope] = (scopes[scope] ?? 0) + 1
    return scopes
  }, {})
}

function formatTimeAgo(date) {
  const minutes = Math.round((Date.now() - date) / 60000)
  if (minutes < 1) {
    return 'just now'
  }
  if (minutes < 60) {
    return `${minutes}m ago`
  }
  const hours = Math.round(minutes / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}
