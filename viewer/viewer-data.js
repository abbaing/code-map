async function loadGraph() {
  const response = await fetch('/graph.json', { cache: 'no-store' })
  state.graph = await response.json()
  state.selectedId = null
  hidePopover()
  initializeFilters()
  applyFilters()
}

function initializeFilters() {
  applyProjectMap(state.graph.projectMap)
  const { nodes, orphans, stats, generatedAt } = state.graph
  const types = unique(nodes.map(node => node.type)).sort()

  initializeFindingsFilters()

  const healthLevels = [
    { key: 'excellent', label: 'Excellent', className: 'text-emerald-700' },
    { key: 'very-good', label: 'Very good', className: 'text-emerald-600' },
    { key: 'good',      label: 'Good',      className: 'text-blue-700' },
    { key: 'fair',      label: 'Fair',      className: 'text-amber-700' },
    { key: 'low',       label: 'Low',       className: 'text-orange-700' },
    { key: 'critical',  label: 'Critical',  className: 'text-red-700' },
  ]
  state.selectedHealth = new Set(healthLevels.map(h => h.key))
  els.healthChecks.innerHTML = ''
  for (const { key, label, className } of healthLevels) {
    const lbl = document.createElement('label')
    lbl.className = 'flex items-center gap-2 text-sm'
    lbl.title = healthDescription(key)
    lbl.innerHTML = `
      <input type="checkbox" checked data-health="${escapeHtml(key)}" />
      <span class="flex-1 font-medium ${className}" title="${escapeHtml(healthDescription(key))}">${escapeHtml(label)}</span>
    `
    els.healthChecks.appendChild(lbl)
  }

  const hiddenByDefaultTypes = new Set(['config'])
  state.selectedTypes = new Set(types.filter(t => !hiddenByDefaultTypes.has(t)))
  els.typeChecks.innerHTML = ''
  for (const type of types) {
    const count = nodes.filter(node => node.type === type).length
    const checked = !hiddenByDefaultTypes.has(type)
    const label = document.createElement('label')
    label.className = 'flex items-center gap-2 text-sm'
    label.innerHTML = `
      <input type="checkbox" ${checked ? 'checked' : ''} data-type="${escapeHtml(type)}" />
      <span class="flex-1">${escapeHtml(formatType(type))}</span>
      <span class="text-xs text-gray-400">${count}</span>
    `
    els.typeChecks.appendChild(label)
  }

  els.orphanCount.textContent = String(orphans.length)
  els.uncoveredCount.textContent = String(nodes.filter(node => isCoverable(node) && !node.meta?.coverage?.hasCoverage).length)
  els.reviewCount.textContent = String(nodes.filter(node => node.meta?.review).length)
  els.findingsCount.textContent = String(nodes.filter(node => node.meta?.findings?.length).length)
  const uncovered = nodes.filter(node => isCoverable(node) && !node.meta?.coverage?.hasCoverage).length
  const coverable = nodes.filter(isCoverable).length
  const findings = state.graph.findings ?? []
  const suppressedFindings = state.graph.suppressedFindings ?? []
  const templates = state.graph.templates ?? []
  const architecture = state.graph.architecture ?? []
  const findingScopes = findings.reduce((acc, finding) => {
    const scope = finding.ruleId?.startsWith('repo.') ? 'repo'
      : finding.ruleId?.startsWith('framework.') ? 'framework'
        : finding.ruleId?.startsWith('technology.') ? 'technology'
          : 'other'
    acc[scope] = (acc[scope] ?? 0) + 1
    return acc
  }, {})
  const generated = new Date(generatedAt)
  const timeAgo = formatTimeAgo(generated)
  els.statsPopover.innerHTML = `
    <p class="text-xs font-semibold uppercase text-gray-400 tracking-wide mb-3">Report · ${generated.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} ${generated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</p>
    <div class="space-y-2">
      <div class="flex justify-between"><span class="text-gray-500">Components</span><span class="font-semibold">${stats.nodes.toLocaleString()}</span></div>
      <div class="flex justify-between"><span class="text-gray-500">Relations</span><span class="font-semibold">${stats.edges.toLocaleString()}</span></div>
      <div class="flex justify-between"><span class="text-gray-500">Orphans</span><span class="font-semibold ${stats.orphans > 0 ? 'text-amber-600' : ''}">${stats.orphans.toLocaleString()}</span></div>
      <div class="flex justify-between"><span class="text-gray-500">No coverage</span><span class="font-semibold ${uncovered > 0 ? 'text-orange-600' : ''}">${uncovered} / ${coverable}</span></div>
      <div class="flex justify-between"><span class="text-gray-500">Findings</span><span class="font-semibold ${findings.length > 0 ? 'text-red-600' : ''}">${findings.length.toLocaleString()}</span></div>
      <div class="flex justify-between"><span class="text-gray-500">Suppressed</span><span class="font-semibold ${suppressedFindings.length > 0 ? 'text-gray-600' : ''}">${suppressedFindings.length.toLocaleString()}</span></div>
      <div class="flex justify-between"><span class="text-gray-500">Templates</span><span class="font-semibold">${templates.length}</span></div>
      <div class="flex justify-between"><span class="text-gray-500">Architectures</span><span class="font-semibold">${architecture.length}</span></div>
    </div>
    <div class="mt-3 pt-3 border-t border-gray-100 space-y-1">
      <p class="text-[11px] font-semibold uppercase text-gray-400">Finding origin</p>
      <div class="flex justify-between"><span class="text-gray-500">Technology</span><span>${findingScopes.technology ?? 0}</span></div>
      <div class="flex justify-between"><span class="text-gray-500">Framework</span><span>${findingScopes.framework ?? 0}</span></div>
      <div class="flex justify-between"><span class="text-gray-500">Repo custom</span><span>${findingScopes.repo ?? 0}</span></div>
    </div>
    <div class="mt-3 pt-3 border-t border-gray-100">
      <p class="text-[11px] font-semibold uppercase text-gray-400 mb-1">Active templates</p>
      <p class="text-[11px] text-gray-500 leading-4">${templates.map(escapeHtml).join(', ') || 'None'}</p>
    </div>
    <div class="mt-3 pt-3 border-t border-gray-100">
      <p class="text-[11px] font-semibold uppercase text-gray-400 mb-1">Architecture</p>
      <p class="text-[11px] text-gray-500 leading-4">${architecture.map(item => escapeHtml(item.label ?? item.id)).join(', ') || 'None'}</p>
    </div>
    <p class="text-[11px] text-gray-300 mt-3">Generated ${timeAgo}</p>
  `
  els.metaPill.textContent = 'Latest report'
}

function applyProjectMap(projectMap = {}) {
  replaceObject(moduleLabels, projectMap.modules?.labels)
  replaceObject(layerLabels, Object.fromEntries((projectMap.layers ?? []).map(layer => [layer.id, layer.label])))
  replaceObject(typeLabels, projectMap.types?.labels)
  replaceObject(colors, projectMap.types?.colors)
  Object.assign(ruleLabels, Object.fromEntries(
    Object.entries(state.graph?.ruleMetadata ?? {}).map(([id, metadata]) => [id, metadata.label ?? formatRuleId(id)])
  ))
  layerOrder.splice(0, layerOrder.length, ...(projectMap.layers ?? []).map(layer => layer.id))
}

function replaceObject(target, source = {}) {
  for (const key of Object.keys(target)) {
    delete target[key]
  }
  Object.assign(target, source)
}

function buildFilterPredicate() {
  const orphanIds = new Set(state.graph.orphans.map(orphan => orphan.id))
  const healthFilterActive = state.selectedHealth.size < 6
  const domainViewIds = state.view === 'domain' ? domainModelNodeIds() : null
  const effectiveModule = state.activeModule ?? 'all'
  const isOverview = state.view === 'overview'
  const query = isOverview ? '' : els.search.value.trim().toLowerCase()

  const predicates = [
    node => !domainViewIds || domainViewIds.has(node.id),
    node => state.selectedTypes.has(node.type),
    node => effectiveModule === 'all' || node.module === effectiveModule,
    node => !els.orphansOnly.checked || orphanIds.has(node.id),
    node => !els.uncoveredOnly.checked || (isCoverable(node) && !node.meta?.coverage?.hasCoverage),
    node => !els.reviewOnly.checked || Boolean(node.meta?.review),
    node => !els.findingsOnly.checked || Boolean(node.meta?.findings?.length),
    node => !els.hideAuxiliary.checked || node.type !== 'auxiliary',
    node => !healthFilterActive || matchesHealthLevel(node),
    node => isOverview || !query || [node.label, node.path, node.id, node.module, node.layer, node.type, formatType(node.type)].filter(Boolean).some(value => String(value).toLowerCase().includes(query))
  ]

  return node => predicates.every(predicate => predicate(node))
}

function applyFilters() {
  state.filteredNodes = state.graph.nodes.filter(buildFilterPredicate())

  if (state.view === 'overview') {
    renderOverview()
  } else if (state.view === 'findings') {
    renderFindings()
  } else {
    render()
  }
  renderModuleDetail()
}

function domainModelNodeIds() {
  const ids = new Set()

  for (const node of state.graph.nodes) {
    if (node.type === 'entity') {
      ids.add(node.id)
    }
  }

  return ids
}


function matchesHealthLevel(node) {
  const score = node.meta?.quality?.score
  if (score == null) return true
  return state.selectedHealth.has(scoreToHealthKey(score))
}

function formatTimeAgo(date) {
  const mins = Math.round((Date.now() - date) / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

function isCoverable(node) {
  const configuredTypes = state.graph.projectMap?.frontend?.coverableTypes
  if (configuredTypes?.length) {
    return Boolean(node.path) && configuredTypes.includes(node.type)
  }
  return Boolean(node.path)
    && ['route', 'page', 'main-component', 'component', 'subcomponent', 'hook', 'service', 'repository', 'store', 'front-file'].includes(node.type)
}
