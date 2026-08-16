import assert from 'node:assert/strict'
import { buildModuleStats, filterAndSortModuleStats } from '#viewer/viewer-module-stats.js'
import { configureViewerElements, moduleLabels, state } from '#viewer/viewer-state.js'

const graph = {
  projectMap: { frontend: { coverableTypes: ['component', 'service', 'page'] } },
  nodes: [
    {
      id: 'accounts-page',
      label: 'Accounts page',
      type: 'component',
      module: 'accounts',
      path: 'src/accounts/AccountsPage.tsx',
      meta: {
        coverage: { hasCoverage: true },
        quality: { score: 9 },
        findings: [{ ruleId: 'frontend.no-any' }, { ruleId: 'frontend.no-any' }]
      }
    },
    {
      id: 'accounts-service',
      label: 'Accounts service',
      type: 'service',
      module: 'accounts',
      path: 'src/accounts/accounts-service.ts',
      meta: {
        review: { reason: 'Dynamic dependency' },
        quality: { score: 7 },
        findings: [{ ruleId: 'repo.module-boundary' }]
      }
    },
    {
      id: 'billing-controller',
      label: 'Billing controller',
      type: 'controller',
      module: 'billing',
      path: 'src/billing/BillingController.cs',
      meta: { quality: { score: 4 } }
    },
    {
      id: 'shared-page',
      label: 'Shared page',
      type: 'page',
      path: 'src/pages/Shared.tsx',
      meta: {}
    }
  ],
  edges: [],
  orphans: [{ id: 'accounts-page' }, { id: 'shared-page' }]
}

Object.assign(state, {
  graph,
  filteredNodes: [graph.nodes[0], graph.nodes[2]],
  selectedHealth: new Set(['excellent', 'very-good', 'good', 'fair', 'low', 'critical'])
})
configureViewerElements({ search: { value: '' } })
Object.assign(moduleLabels, { accounts: 'Customer accounts', billing: 'Payments' })

const stats = buildModuleStats()
assert.deepEqual([...stats.keys()], ['accounts', 'billing'])
assert.deepEqual(stats.get('accounts'), {
  nodes: 2,
  orphans: 1,
  uncovered: 1,
  review: 1,
  findings: 3,
  findingRules: new Map([
    ['frontend.no-any', 2],
    ['repo.module-boundary', 1]
  ]),
  qualitySum: 16,
  qualityCount: 2
})
assert.deepEqual(stats.get('billing'), {
  nodes: 1,
  orphans: 0,
  uncovered: 0,
  review: 0,
  findings: 0,
  findingRules: new Map(),
  qualitySum: 4,
  qualityCount: 1
})

assert.deepEqual(
  filterAndSortModuleStats(stats).map(([name]) => name),
  ['accounts', 'billing'],
  'module labels must determine presentation order'
)

configureViewerElements({ search: { value: 'CUSTOMER' } })
assert.deepEqual(
  filterAndSortModuleStats(stats).map(([name]) => name),
  ['accounts'],
  'search must match configured labels without case sensitivity'
)

configureViewerElements({ search: { value: '' } })
state.selectedHealth = new Set(['critical'])
assert.deepEqual(
  filterAndSortModuleStats(stats).map(([name]) => name),
  ['billing'],
  'active health filters must use the average module quality'
)

state.filteredNodes = graph.nodes
state.selectedHealth = new Set(['excellent', 'very-good', 'good', 'fair', 'low', 'critical'])
assert.equal(buildModuleStats().get('shared').uncovered, 1, 'missing module ids must belong to shared')

console.log('viewer module statistics tests passed')
