function buildModuleStats() {
  const modules = new Map()
  const orphanIds = new Set(state.graph.orphans.map(o => o.id))

  // Determine which modules are visible after filtering
  const visibleModules = new Set(state.filteredNodes.map(n => n.module || 'shared'))

  // Compute stats using all nodes so scores are stable regardless of active filters
  for (const node of state.graph.nodes) {
    const m = node.module || 'shared'
    if (!visibleModules.has(m)) continue
    if (!modules.has(m)) {
      modules.set(m, {
        nodes: 0,
        orphans: 0,
        uncovered: 0,
        review: 0,
        findings: 0,
        findingRules: new Map(),
        qualitySum: 0,
        qualityCount: 0
      })
    }
    const s = modules.get(m)
    s.nodes++
    if (orphanIds.has(node.id)) s.orphans++
    if (isCoverable(node) && !node.meta?.coverage?.hasCoverage) s.uncovered++
    if (node.meta?.review) s.review++
    for (const finding of node.meta?.findings ?? []) {
      s.findings++
      s.findingRules.set(finding.ruleId, (s.findingRules.get(finding.ruleId) ?? 0) + 1)
    }
    if (node.meta?.quality) {
      s.qualitySum += node.meta.quality.score
      s.qualityCount++
    }
  }
  return modules
}

function moduleHealthKey(s) {
  if (s.qualityCount === 0) return 'n/a'
  return scoreToHealthKey(s.qualitySum / s.qualityCount)
}

function filterAndSortModuleStats(stats) {
  const healthFilterActive = state.selectedHealth.size < 6
  const query = els.search.value.trim().toLowerCase()
  const matchesQuery = name => !query
    || name.toLowerCase().includes(query)
    || formatModule(name).toLowerCase().includes(query)
  const matchesHealth = s => !healthFilterActive || state.selectedHealth.has(moduleHealthKey(s))

  return [...stats.entries()]
    .filter(([name, s]) => matchesQuery(name) && matchesHealth(s))
    .sort(([a], [b]) => formatModule(a).localeCompare(formatModule(b), undefined, { sensitivity: 'base' }))
}

function moduleCardHtml(name, s) {
  const avgQ = s.qualityCount > 0 ? s.qualitySum / s.qualityCount : null
  const health = healthPill(avgQ)
  return `
    <div class="module-card bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-blue-500 hover:shadow-md transition-shadow" data-module="${escapeHtml(name)}">
      <div class="flex items-start justify-between gap-2">
        <div>
          <div class="font-semibold text-sm leading-tight">${escapeHtml(formatModule(name))}</div>
          <div class="text-xs text-gray-500 mt-1">${s.nodes} component${s.nodes === 1 ? '' : 's'}</div>
        </div>
      </div>
      <div class="mt-2 flex flex-wrap gap-1">
        ${pillHtml(health.className, health.label, health.description)}
        ${s.findings ? pillHtml('bg-red-50 text-red-700 border border-red-100', `${s.findings} finding${s.findings === 1 ? '' : 's'}`) : ''}
      </div>
    </div>
  `
}

function renderOverview() {
  const stats = buildModuleStats()
  const sorted = filterAndSortModuleStats(stats)
  els.overviewScroll.innerHTML = sorted.map(([name, s]) => moduleCardHtml(name, s)).join('')
}


function renderModuleDetail() {
  if (!els.moduleDetail) return
  const selectedNode = state.selectedId
    ? state.graph?.nodes.find(node => node.id === state.selectedId)
    : null
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

  const moduleNodes = state.graph.nodes.filter(node => node.module === moduleName)
  const moduleNodeIds = new Set(moduleNodes.map(node => node.id))
  const moduleEdges = state.graph.edges.filter(edge => moduleNodeIds.has(edge.from) || moduleNodeIds.has(edge.to))
  const orphanIds = new Set(state.graph.orphans.map(orphan => orphan.id))
  const coverable = moduleNodes.filter(isCoverable)
  const covered = coverable.filter(node => node.meta?.coverage?.hasCoverage)
  const qualityNodes = moduleNodes.filter(node => node.meta?.quality)
  const avgQuality = qualityNodes.length
    ? qualityNodes.reduce((sum, node) => sum + node.meta.quality.score, 0) / qualityNodes.length
    : null
  const orphans = moduleNodes.filter(node => orphanIds.has(node.id))
  const review = moduleNodes.filter(node => node.meta?.review)
  const findings = moduleNodes.flatMap(node => node.meta?.findings ?? [])
  const externalEdges = moduleEdges.filter(edge => {
    const from = state.graph.nodes.find(node => node.id === edge.from)
    const to = state.graph.nodes.find(node => node.id === edge.to)
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
  state.panX = 0
  state.panY = 0
updateViewUI()
  applyFilters()
}

function updateViewUI() {
  const isOverview = state.view === 'overview'
  const isDomain = state.view === 'domain'
  const isFindings = state.view === 'findings'
  const isSettings = state.view === 'settings'
  els.overviewPane.classList.toggle('hidden', !isOverview)
  els.findingsPane.classList.toggle('hidden', !isFindings)
  els.settingsPane.classList.toggle('hidden', !isSettings)
  els.canvasWrap.classList.toggle('hidden', isOverview || isFindings || isSettings)
  els.tabOverview.classList.toggle('active', isOverview)
  els.tabGraph.classList.toggle('active', state.view === 'graph')
  els.tabDomain.classList.toggle('active', isDomain)
  els.tabFindings.classList.toggle('active', isFindings)
  els.tabSettings.classList.toggle('active', isSettings)
}
