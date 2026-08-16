import assert from 'node:assert/strict'
import { layoutLayeredNodes } from '#viewer/viewer-layout-layered.js'
import { inferAuxiliaryLayers, moduleWeight, nodeSortWeight } from '#viewer/viewer-layout-layered-policy.js'
import { layerOrder, state } from '#viewer/viewer-state.js'

const nodes = [
  {
    id: 'routes',
    label: 'Routes',
    type: 'route',
    module: 'accounts',
    layer: 'ui-page',
    path: 'front/accounts/routes.ts'
  },
  {
    id: 'page',
    label: 'Accounts page',
    type: 'page',
    module: 'accounts',
    layer: 'ui-page',
    path: 'front/accounts/AccountsPage.tsx'
  },
  {
    id: 'hook',
    label: 'Use accounts',
    type: 'hook',
    module: 'accounts',
    layer: 'auxiliary',
    path: 'front/accounts/useAccounts.ts'
  },
  {
    id: 'detached-helper',
    label: 'Detached helper',
    type: 'auxiliary',
    module: 'accounts',
    layer: 'auxiliary',
    path: 'front/accounts/detached.ts'
  },
  {
    id: 'controller',
    label: 'Accounts controller',
    type: 'controller',
    module: 'accounts',
    layer: 'application-handler',
    path: 'back/AccountsController.cs'
  },
  {
    id: 'shared-service',
    label: 'Shared service',
    type: 'service',
    module: 'common',
    layer: 'backend-service',
    path: 'back/SharedService.cs'
  }
]
const edges = [
  { id: 'routes:page', from: 'routes', to: 'page', type: 'renders' },
  { id: 'hook:page', from: 'hook', to: 'page', type: 'supports' },
  { id: 'detached:missing', from: 'detached-helper', to: 'missing', type: 'imports' },
  { id: 'page:controller', from: 'page', to: 'controller', type: 'calls-api' }
]
state.graph = { nodes, edges, projectMap: { modules: { shared: 'common' } } }

assert.deepEqual(inferAuxiliaryLayers(nodes), new Map([['hook', 'ui-page']]))
assert.equal(moduleWeight('accounts'), 0)
assert.equal(moduleWeight('common'), 999)

const weightedNodes = [
  ['routes.ts', 0],
  ['AccountsPage.tsx', 1],
  ['MainView.tsx', 2],
  ['index.ts', 3],
  ['feature.ts', 5],
  ['AccountRepository.cs', 8],
  ['AccountsController.cs', 9],
  ['CreateAccountHandler.cs', 10]
]
for (const [label, weight] of weightedNodes) {
  assert.equal(nodeSortWeight({ label }), weight, `${label} must retain its architectural ordering weight`)
}

layerOrder.splice(0, layerOrder.length, 'ui-page', 'ui-component-logic', 'application-handler', 'backend-service')
const firstLayout = layoutLayeredNodes(nodes, 900, 700)
const secondLayout = layoutLayeredNodes(nodes, 900, 700)
const positioned = new Map(firstLayout.nodes.map((node) => [node.id, node]))

assert.deepEqual(
  firstLayout.nodes.map(({ id, x, y, layoutLayer, level }) => ({ id, x, y, layoutLayer, level })),
  secondLayout.nodes.map(({ id, x, y, layoutLayer, level }) => ({ id, x, y, layoutLayer, level })),
  'layered layout must be deterministic'
)
assert.equal(positioned.get('hook').layoutLayer, 'ui-page')
assert.equal(positioned.get('detached-helper').layoutLayer, 'ui-component-logic')
assert.equal(positioned.get('routes').level, 0)
assert.equal(positioned.get('page').level, 1)
assert.equal(positioned.get('page').x - positioned.get('routes').x, 198)
assert.equal(
  firstLayout.moduleLabels.at(-1).module,
  'common',
  'the configured shared module must remain after feature modules'
)
assert.equal(firstLayout.width >= 900, true)
assert.equal(firstLayout.height >= 700, true)

console.log('viewer layered layout tests passed')
