import assert from 'node:assert/strict'
import { initializeFilterControls } from '#viewer/viewer-filter-controls.js'
import { buildViewerReport } from '#viewer/viewer-report-model.js'
import { renderReportSummary, reportPopoverHtml } from '#viewer/viewer-report-renderer.js'
import { state } from '#viewer/viewer-state.js'

const generatedAt = '2026-08-14T08:00:00.000Z'
const graph = {
  projectMap: {
    project: { name: 'Accounts <Map>' },
    frontend: { coverableTypes: ['component', 'page'] }
  },
  generatedAt,
  stats: { nodes: 3, edges: 2, orphans: 1, skippedFiles: 1 },
  nodes: [
    {
      id: 'component',
      type: 'component',
      module: 'accounts',
      path: 'src/Account.tsx',
      meta: { coverage: { hasCoverage: true } }
    },
    { id: 'page', type: 'page', path: 'src/AccountsPage.tsx', meta: {} },
    { id: 'controller', type: 'controller', module: 'accounts', meta: { review: true, findings: [{}] } }
  ],
  orphans: [{ id: 'page' }],
  findings: [
    { ruleId: 'technology.typescript.no-any' },
    { ruleId: 'framework.react.component-max-lines' },
    { ruleId: 'repo.accounts.boundary' },
    { ruleId: 'other.rule' }
  ],
  suppressedFindings: [{ ruleId: 'repo.suppressed' }],
  templates: ['react<script>'],
  architecture: [{ id: 'clean', label: '<Clean>' }]
}

const report = buildViewerReport(graph, Date.parse(generatedAt) + 90 * 60_000)
assert.deepEqual(
  {
    moduleCount: report.moduleCount,
    coverable: report.coverable,
    uncovered: report.uncovered,
    coveragePercent: report.coveragePercent,
    timeAgo: report.timeAgo,
    scopes: report.scopes
  },
  {
    moduleCount: 2,
    coverable: 2,
    uncovered: 1,
    coveragePercent: 50,
    timeAgo: '2h ago',
    scopes: { technology: 1, framework: 1, repo: 1, other: 1 }
  }
)

const markup = reportPopoverHtml(report)
assert.match(markup, /No coverage/u)
assert.match(markup, /1 \/ 2/u)
assert.match(markup, /react&lt;script&gt;/u)
assert.match(markup, /&lt;Clean&gt;/u)
assert.doesNotMatch(markup, /<script>/u)

const updatedLabel = textElement()
const elements = reportElements(updatedLabel)
renderReportSummary(report, graph, elements)
assert.equal(elements.projectName.textContent, 'Accounts <Map>')
assert.equal(elements.metricModules.textContent, '2')
assert.equal(elements.metricNodes.textContent, '3')
assert.equal(elements.metricCoverage.textContent, '50%')
assert.equal(elements.metricFindings.textContent, '4')
assert.equal(elements.metricFindings.classes.has('text-red-700'), true)
assert.equal(updatedLabel.textContent, 'Updated 2h ago')
assert.equal(elements.statsPopover.innerHTML, markup)

const controls = filterElements()
initializeFilterControls(graph, controls, { createElement: () => ({}) })
assert.equal(controls.healthChecks.children.length, 6)
assert.equal(controls.typeChecks.children.length, 3)
assert.deepEqual([...state.selectedTypes], ['component', 'page'])
assert.equal(controls.orphanCount.textContent, '1')
assert.equal(controls.uncoveredCount.textContent, '1')
assert.equal(controls.reviewCount.textContent, '1')
assert.equal(controls.findingsCount.textContent, '1')

console.log('viewer filter presentation tests passed')

function textElement() {
  const classes = new Set()
  return {
    textContent: '',
    innerHTML: '',
    classes,
    classList: {
      toggle(name, enabled) {
        if (enabled) {
          classes.add(name)
        } else {
          classes.delete(name)
        }
      }
    }
  }
}

function reportElements(updatedLabel) {
  const elements = Object.fromEntries(
    [
      'projectName',
      'metricModules',
      'metricNodes',
      'metricEdges',
      'metricFindings',
      'metricCoverage',
      'sidebarFindingsCount',
      'statsPopover'
    ].map((name) => [name, textElement()])
  )
  elements.metaPill = { querySelector: () => updatedLabel }
  return elements
}

function filterElements() {
  const container = () => ({
    innerHTML: '',
    children: [],
    appendChild(element) {
      this.children.push(element)
    }
  })
  return {
    healthChecks: container(),
    typeChecks: container(),
    orphanCount: textElement(),
    uncoveredCount: textElement(),
    reviewCount: textElement(),
    findingsCount: textElement()
  }
}
