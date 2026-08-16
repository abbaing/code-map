import { requireViewOperations } from '#viewer/viewer-data-context.js'
import { els, state } from '#viewer/viewer-state.js'
import { moduleTraceNodeIds } from '#viewer/viewer-trace.js'
import { formatType, scoreToHealthKey } from '#viewer/viewer-utils.js'

export function applyFilters() {
  state.filteredNodes = state.graph.nodes.filter(buildFilterPredicate())
  const operations = requireViewOperations()
  if (state.view === 'overview') {
    operations.renderOverview()
  } else if (state.view === 'findings') {
    operations.renderFindings()
  } else {
    operations.renderGraph()
  }
  operations.renderModuleDetail()
}

export function isCoverable(node, projectMap = state.graph.projectMap) {
  const configuredTypes = projectMap?.frontend?.coverableTypes
  if (configuredTypes?.length) {
    return Boolean(node.path) && configuredTypes.includes(node.type)
  }
  const defaults = [
    'route',
    'page',
    'main-component',
    'component',
    'subcomponent',
    'hook',
    'service',
    'repository',
    'store',
    'front-file'
  ]
  return Boolean(node.path) && defaults.includes(node.type)
}

function buildFilterPredicate() {
  const context = filterContext()
  const predicates = [
    (node) => !context.domainIds || context.domainIds.has(node.id),
    (node) => state.selectedTypes.has(node.type),
    (node) => !context.moduleIds || context.moduleIds.has(node.id),
    (node) => !els.orphansOnly.checked || context.orphanIds.has(node.id),
    (node) => !els.uncoveredOnly.checked || (isCoverable(node) && !node.meta?.coverage?.hasCoverage),
    (node) => !els.reviewOnly.checked || Boolean(node.meta?.review),
    (node) => !els.findingsOnly.checked || Boolean(node.meta?.findings?.length),
    (node) => !els.hideAuxiliary.checked || node.type !== 'auxiliary',
    (node) => !context.healthActive || matchesHealthLevel(node),
    (node) => matchesQuery(node, context)
  ]
  return (node) => predicates.every((predicate) => predicate(node))
}

function filterContext() {
  const module = state.activeModule ?? 'all'
  const overview = state.view === 'overview'
  return {
    orphanIds: new Set(state.graph.orphans.map((orphan) => orphan.id)),
    healthActive: state.selectedHealth.size < 6,
    domainIds: state.view === 'domain' ? domainModelNodeIds() : null,
    moduleIds: module === 'all' ? null : moduleTraceNodeIds(state.graph, module),
    overview,
    query: overview ? '' : els.graphSearch.value.trim().toLowerCase()
  }
}

function matchesQuery(node, context) {
  if (context.overview || !context.query) {
    return true
  }
  return [node.label, node.path, node.id, node.module, node.layer, node.type, formatType(node.type)]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(context.query))
}

function domainModelNodeIds() {
  return new Set(state.graph.nodes.filter((node) => node.type === 'entity').map((node) => node.id))
}

function matchesHealthLevel(node) {
  const score = node.meta?.quality?.score
  return score != null && state.selectedHealth.has(scoreToHealthKey(score))
}
