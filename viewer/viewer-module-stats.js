import { isCoverable } from '#viewer/viewer-data.js'
import { els, state } from '#viewer/viewer-state.js'
import { formatModule, scoreToHealthKey } from '#viewer/viewer-utils.js'

export function buildModuleStats() {
  const modules = new Map()
  const orphanIds = new Set(state.graph.orphans.map((orphan) => orphan.id))
  const visibleModules = new Set(state.filteredNodes.map((node) => node.module || 'shared'))
  for (const node of state.graph.nodes) {
    const module = node.module || 'shared'
    if (!visibleModules.has(module)) {
      continue
    }
    const stats = modules.get(module) ?? emptyStats()
    addNodeStats(stats, node, orphanIds)
    modules.set(module, stats)
  }
  return modules
}

export function filterAndSortModuleStats(stats) {
  const healthFilterActive = state.selectedHealth.size < 6
  const query = els.search.value.trim().toLowerCase()
  return [...stats.entries()]
    .filter(([name, item]) => matchesQuery(name, query) && matchesHealth(item, healthFilterActive))
    .sort(([a], [b]) => formatModule(a).localeCompare(formatModule(b), undefined, { sensitivity: 'base' }))
}

function emptyStats() {
  return {
    nodes: 0,
    orphans: 0,
    uncovered: 0,
    review: 0,
    findings: 0,
    findingRules: new Map(),
    qualitySum: 0,
    qualityCount: 0
  }
}

function addNodeStats(stats, node, orphanIds) {
  stats.nodes++
  addClassificationStats(stats, node, orphanIds)
  addFindingStats(stats, node.meta?.findings ?? [])
  addQualityStats(stats, node.meta?.quality)
}

function addClassificationStats(stats, node, orphanIds) {
  if (orphanIds.has(node.id)) {
    stats.orphans++
  }
  if (isCoverable(node) && !node.meta?.coverage?.hasCoverage) {
    stats.uncovered++
  }
  if (node.meta?.review) {
    stats.review++
  }
}

function addFindingStats(stats, findings) {
  for (const finding of findings) {
    stats.findings++
    stats.findingRules.set(finding.ruleId, (stats.findingRules.get(finding.ruleId) ?? 0) + 1)
  }
}

function addQualityStats(stats, quality) {
  if (quality) {
    stats.qualitySum += quality.score
    stats.qualityCount++
  }
}

function matchesQuery(name, query) {
  return !query || name.toLowerCase().includes(query) || formatModule(name).toLowerCase().includes(query)
}

function matchesHealth(stats, active) {
  const key = stats.qualityCount ? scoreToHealthKey(stats.qualitySum / stats.qualityCount) : 'n/a'
  return !active || state.selectedHealth.has(key)
}
