import assert from 'node:assert/strict'
import { applyFilters, configureViewerData, isCoverable } from '#viewer/viewer-data.js'
import { configureViewerElements, state, typeLabels } from '#viewer/viewer-state.js'

const nodes = [
  {
    id: 'users-page',
    label: 'Users page',
    type: 'page',
    module: 'users',
    layer: 'ui-page',
    path: 'front/users/UsersPage.tsx',
    meta: { coverage: { hasCoverage: true }, quality: { score: 9 }, findings: [{ ruleId: 'repo.boundary' }] }
  },
  {
    id: 'users-form',
    label: 'Users form',
    type: 'component',
    module: 'users',
    layer: 'ui-component',
    path: 'front/users/UsersForm.tsx',
    meta: { quality: { score: 6 }, review: { reason: 'Dynamic import' } }
  },
  {
    id: 'users-helper',
    label: 'Users helper',
    type: 'auxiliary',
    module: 'users',
    layer: 'auxiliary',
    path: 'front/users/users-helper.ts',
    meta: {}
  },
  {
    id: 'account',
    label: 'Account',
    type: 'entity',
    module: 'billing',
    layer: 'domain',
    path: 'back/Account.cs',
    meta: { quality: { score: 4 } }
  },
  {
    id: 'users-controller',
    label: 'Users controller',
    type: 'controller',
    module: 'users',
    layer: 'application-handler',
    path: 'back/UsersController.cs',
    meta: { quality: { score: 8 } }
  }
]
const graph = {
  projectMap: { frontend: { coverableTypes: ['page', 'component'] } },
  nodes,
  edges: [],
  orphans: [{ id: 'users-form' }]
}

const calls = []
const operation = (name) => () => calls.push(name)
configureViewerData({
  gateway: {
    loadGraph() {},
    scan() {},
    updateProjectMap() {},
    listSubmaps() {},
    loadSubmap() {},
    createSelectionSubmap() {},
    createTraceSubmap() {},
    reviseSubmap() {},
    deleteSubmap() {}
  },
  operations: {
    hidePopover: operation('hidePopover'),
    initializeFindingsFilters: operation('initializeFindingsFilters'),
    renderFindings: operation('renderFindings'),
    renderGraph: operation('renderGraph'),
    renderModuleDetail: operation('renderModuleDetail'),
    renderOverview: operation('renderOverview')
  }
})

const controls = {
  orphansOnly: { checked: false },
  uncoveredOnly: { checked: false },
  reviewOnly: { checked: false },
  findingsOnly: { checked: false },
  hideAuxiliary: { checked: false },
  graphSearch: { value: '' }
}
configureViewerElements(controls)
Object.assign(typeLabels, { component: 'UI component' })

function resetState(view = 'graph') {
  Object.assign(state, {
    graph,
    view,
    activeModule: null,
    selectedTypes: new Set(nodes.map((node) => node.type)),
    selectedHealth: new Set(['excellent', 'very-good', 'good', 'fair', 'low', 'critical'])
  })
  for (const control of Object.values(controls)) {
    if ('checked' in control) {
      control.checked = false
    }
  }
  controls.graphSearch.value = ''
  calls.length = 0
}

function applyAndRead() {
  applyFilters()
  return state.filteredNodes.map((node) => node.id)
}

assert.equal(isCoverable(nodes[0], graph.projectMap), true)
assert.equal(isCoverable(nodes[2], graph.projectMap), false)
assert.equal(isCoverable({ type: 'service', path: 'back/service.ts' }, {}), true)
assert.equal(isCoverable({ type: 'controller', path: 'back/controller.cs' }, {}), false)
assert.equal(isCoverable({ type: 'page' }, graph.projectMap), false)

resetState('overview')
assert.deepEqual(
  applyAndRead(),
  nodes.map((node) => node.id)
)
assert.deepEqual(calls, ['renderOverview', 'renderModuleDetail'])

resetState()
state.selectedTypes = new Set(['component'])
assert.deepEqual(applyAndRead(), ['users-form'])

resetState()
controls.orphansOnly.checked = true
controls.uncoveredOnly.checked = true
controls.reviewOnly.checked = true
assert.deepEqual(applyAndRead(), ['users-form'])

resetState('findings')
controls.findingsOnly.checked = true
assert.deepEqual(applyAndRead(), ['users-page'])
assert.deepEqual(calls, ['renderFindings', 'renderModuleDetail'])

resetState()
controls.hideAuxiliary.checked = true
assert.equal(applyAndRead().includes('users-helper'), false)

resetState()
state.selectedHealth = new Set(['critical'])
assert.deepEqual(applyAndRead(), ['account'])

resetState()
controls.graphSearch.value = 'ui component'
assert.deepEqual(applyAndRead(), ['users-form'])

resetState('overview')
controls.graphSearch.value = 'no-match'
assert.equal(applyAndRead().length, nodes.length, 'overview search is handled at module level')

resetState('domain')
assert.deepEqual(applyAndRead(), ['account'])
assert.deepEqual(calls, ['renderGraph', 'renderModuleDetail'])

resetState()
state.activeModule = 'users'
assert.deepEqual(applyAndRead(), ['users-page', 'users-form', 'users-helper'])

console.log('viewer filter tests passed')
