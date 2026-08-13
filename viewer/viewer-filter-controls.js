import { isCoverable } from '#viewer/viewer-filters.js'
import { state } from '#viewer/viewer-state.js'
import { escapeHtml, formatType, healthDescription, unique } from '#viewer/viewer-utils.js'

const healthLevels = [
  ['excellent', 'Excellent', 'text-emerald-700'],
  ['very-good', 'Very good', 'text-emerald-600'],
  ['good', 'Good', 'text-blue-700'],
  ['fair', 'Fair', 'text-amber-700'],
  ['low', 'Low', 'text-orange-700'],
  ['critical', 'Critical', 'text-red-700']
]

export function initializeFilterControls(graph, elements, documentRef) {
  initializeHealthFilters(elements, documentRef)
  initializeTypeFilters(graph, elements, documentRef)
  renderFilterCounts(graph, elements)
}

function initializeHealthFilters(elements, documentRef) {
  state.selectedHealth = new Set(healthLevels.map(([key]) => key))
  elements.healthChecks.innerHTML = ''
  for (const [key, label, className] of healthLevels) {
    const element = documentRef.createElement('label')
    element.className = 'flex items-center gap-2 text-sm'
    element.title = healthDescription(key)
    element.innerHTML = `<input type="checkbox" checked data-health="${escapeHtml(key)}" />
      <span class="flex-1 font-medium ${className}" title="${escapeHtml(healthDescription(key))}">${escapeHtml(label)}</span>`
    elements.healthChecks.appendChild(element)
  }
}

function initializeTypeFilters(graph, elements, documentRef) {
  const types = unique(graph.nodes.map((node) => node.type)).sort()
  const hidden = new Set(['config', 'controller'])
  state.selectedTypes = new Set(types.filter((type) => !hidden.has(type)))
  elements.typeChecks.innerHTML = ''
  for (const type of types) {
    const count = graph.nodes.filter((node) => node.type === type).length
    const element = documentRef.createElement('label')
    element.className = 'flex items-center gap-2 text-sm'
    element.innerHTML = `<input type="checkbox" ${hidden.has(type) ? '' : 'checked'} data-type="${escapeHtml(type)}" />
      <span class="flex-1">${escapeHtml(formatType(type))}</span><span class="text-xs text-gray-400">${count}</span>`
    elements.typeChecks.appendChild(element)
  }
}

function renderFilterCounts(graph, elements) {
  const uncovered = graph.nodes.filter(
    (node) => isCoverable(node, graph.projectMap) && !node.meta?.coverage?.hasCoverage
  )
  elements.orphanCount.textContent = String(graph.orphans.length)
  elements.uncoveredCount.textContent = String(uncovered.length)
  elements.reviewCount.textContent = String(graph.nodes.filter((node) => node.meta?.review).length)
  elements.findingsCount.textContent = String(graph.nodes.filter((node) => node.meta?.findings?.length).length)
}
