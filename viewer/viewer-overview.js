import { applyFilters, isCoverable } from '#viewer/viewer-data.js'
import { buildModuleStats, filterAndSortModuleStats } from '#viewer/viewer-module-stats.js'
import { selectedNodeDetailHtml } from '#viewer/viewer-selection.js'
import { els, state } from '#viewer/viewer-state.js'
import { escapeHtml, formatModule, healthPill, pillHtml } from '#viewer/viewer-utils.js'

function moduleCardHtml(name, s) {
  const avgQ = s.qualityCount > 0 ? s.qualitySum / s.qualityCount : null
  const health = healthPill(avgQ)
  return `
    <button class="module-card" data-module="${escapeHtml(name)}">
      <span class="module-name">
        <strong>${escapeHtml(formatModule(name))}</strong>
        <span>${escapeHtml(name)}</span>
      </span>
      <span class="module-cell">${pillHtml(health.className, health.label, health.description)}</span>
      <span class="module-cell module-components">${s.nodes.toLocaleString()}</span>
      <span class="module-cell module-findings ${s.findings ? 'text-red-700 font-semibold' : ''}">${s.findings.toLocaleString()}</span>
      <span class="module-arrow" aria-hidden="true">›</span>
    </button>
  `
}

function renderOverview() {
  const stats = buildModuleStats()
  const sorted = filterAndSortModuleStats(stats)
  els.overviewScroll.innerHTML = sorted.length
    ? sorted.map(([name, s]) => moduleCardHtml(name, s)).join('')
    : '<div class="px-4 py-10 text-center text-sm text-gray-500">No modules match the current filters.</div>'
}

function renderModuleDetail() {
  if (!els.moduleDetail) {
    return
  }
  const selectedNode = state.selectedId ? state.graph?.nodes.find((node) => node.id === state.selectedId) : null
  if (selectedNode) {
    els.moduleDetail.classList.remove('hidden')
    els.moduleDetail.innerHTML = selectedNodeDetailHtml(selectedNode)
    return
  }

  const moduleName = state.activeModule
  if (!moduleName || !state.graph) {
    els.moduleDetail.classList.add('hidden')
    els.moduleDetail.innerHTML = ''
    return
  }

  if (state.view === 'graph') {
    els.moduleDetail.classList.add('hidden')
    els.moduleDetail.innerHTML = ''
    return
  }

  const moduleNodes = state.graph.nodes.filter((node) => node.module === moduleName)
  const moduleNodeIds = new Set(moduleNodes.map((node) => node.id))
  const moduleEdges = state.graph.edges.filter((edge) => moduleNodeIds.has(edge.from) || moduleNodeIds.has(edge.to))
  const orphanIds = new Set(state.graph.orphans.map((orphan) => orphan.id))
  const coverable = moduleNodes.filter(isCoverable)
  const covered = coverable.filter((node) => node.meta?.coverage?.hasCoverage)
  const qualityNodes = moduleNodes.filter((node) => node.meta?.quality)
  const avgQuality = qualityNodes.length
    ? qualityNodes.reduce((sum, node) => sum + node.meta.quality.score, 0) / qualityNodes.length
    : null
  const orphans = moduleNodes.filter((node) => orphanIds.has(node.id))
  const review = moduleNodes.filter((node) => node.meta?.review)
  const findings = moduleNodes.flatMap((node) => node.meta?.findings ?? [])
  const externalEdges = moduleEdges.filter((edge) => {
    const from = state.graph.nodes.find((node) => node.id === edge.from)
    const to = state.graph.nodes.find((node) => node.id === edge.to)
    return from && to && from.module !== to.module
  })

  const health = healthPill(avgQuality)
  els.moduleDetail.classList.remove('hidden')
  els.moduleDetail.innerHTML = `
    <div class="font-semibold text-sm leading-tight mb-0.5">${escapeHtml(formatModule(moduleName))}</div>
    <div class="text-gray-400 mb-2">${moduleNodes.length} components · ${moduleEdges.length} relations</div>
    <div class="flex flex-wrap gap-1 mb-3">
      ${pillHtml(health.className, health.label)}
      ${findings.length ? pillHtml('bg-red-50 text-red-700 border border-red-100', `${findings.length} finding${findings.length === 1 ? '' : 's'}`) : ''}
    </div>
    <div class="grid grid-cols-2 gap-1 text-[11px]">
      ${detailStat('Coverage', `${covered.length}/${coverable.length}`)}
      ${detailStat('Orphans', orphans.length)}
      ${detailStat('External', externalEdges.length)}
      ${detailStat('Review', review.length)}
    </div>
  `
}

function detailStat(label, value) {
  return `
    <div class="bg-gray-50 border border-gray-100 rounded px-2 py-1.5">
      <div class="text-gray-400">${escapeHtml(label)}</div>
      <div class="font-semibold text-gray-800">${escapeHtml(value)}</div>
    </div>
  `
}

function drillIntoModule(moduleName) {
  state.activeModule = moduleName
  state.view = 'graph'
  els.search.value = ''
  state.panX = 0
  state.panY = 0
  state.fitView = true
  updateViewUI()
  applyFilters()
}

function updateViewUI() {
  const isOverview = state.view === 'overview'
  const isDomain = state.view === 'domain'
  const isFindings = state.view === 'findings'
  const isSettings = state.view === 'settings'
  const isSubmaps = state.view === 'submaps'
  els.overviewPane.classList.toggle('hidden', !isOverview)
  els.findingsPane.classList.toggle('hidden', !isFindings)
  els.settingsPane.classList.toggle('hidden', !isSettings)
  els.submapsPane.classList.toggle('hidden', !isSubmaps)
  els.canvasWrap.classList.toggle('hidden', isOverview || isFindings || isSettings || isSubmaps)
  els.tabOverview.classList.toggle('active', isOverview)
  els.tabGraph.classList.toggle('active', state.view === 'graph')
  els.tabDomain.classList.toggle('active', isDomain)
  els.tabFindings.classList.toggle('active', isFindings)
  els.tabSettings.classList.toggle('active', isSettings)
  els.tabSubmaps.classList.toggle('active', isSubmaps)

  const viewCopy = {
    overview: ['Overview', 'Repository health and module inventory'],
    graph: [
      'Graph',
      state.activeSubmap
        ? `Focused on ${state.activeSubmap.name}`
        : state.activeModule
          ? `Exploring ${formatModule(state.activeModule)}`
          : 'Dependencies between repository components'
    ],
    domain: ['Domain model', 'Entities and their structural relationships'],
    findings: ['Findings', 'Architecture violations and maintainability risks'],
    submaps: ['Submaps', 'Named architectural contexts saved from the graph'],
    settings: ['Settings', 'Project labels, colors and active rules']
  }
  const [title, subtitle] = viewCopy[state.view] ?? viewCopy.overview
  els.viewTitle.textContent = title
  els.viewSubtitle.textContent = subtitle
}

export { drillIntoModule, renderModuleDetail, renderOverview, updateViewUI }
