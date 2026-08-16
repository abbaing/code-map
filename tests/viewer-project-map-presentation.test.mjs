import assert from 'node:assert/strict'
import { applyProjectMap } from '#viewer/viewer-project-map-presentation.js'
import { colors, layerLabels, layerOrder, moduleLabels, state, typeLabels } from '#viewer/viewer-state.js'
import { formatLayer, formatModule, formatRuleId, formatType } from '#viewer/viewer-utils.js'

state.graph = {
  ruleMetadata: {
    'repo.module-boundary': { label: 'Module boundary' },
    'repo.generated-name': {}
  }
}
applyProjectMap({
  modules: { labels: { accounts: 'Customer accounts', shared: 'Common' } },
  layers: [
    { id: 'ui-page', label: 'Pages' },
    { id: 'application-handler', label: 'Handlers' }
  ],
  types: {
    labels: { component: 'UI component', handler: 'Command handler' },
    colors: { component: '#2563eb', handler: '#7c3aed' }
  }
})

assert.deepEqual(moduleLabels, { accounts: 'Customer accounts', shared: 'Common' })
assert.deepEqual(layerLabels, { 'ui-page': 'Pages', 'application-handler': 'Handlers' })
assert.deepEqual(layerOrder, ['ui-page', 'application-handler'])
assert.deepEqual(typeLabels, { component: 'UI component', handler: 'Command handler' })
assert.deepEqual(colors, { component: '#2563eb', handler: '#7c3aed' })
assert.equal(formatModule('accounts'), 'Customer accounts')
assert.equal(formatLayer('ui-page'), 'Pages')
assert.equal(formatType('component'), 'UI component')
assert.equal(formatRuleId('repo.module-boundary'), 'Module boundary')
assert.equal(formatRuleId('repo.generated-name'), 'Generated Name')

state.graph = { ruleMetadata: { 'repo.current-check': { label: 'Current check' } } }
applyProjectMap()

assert.deepEqual(moduleLabels, {})
assert.deepEqual(layerLabels, {})
assert.deepEqual(layerOrder, [])
assert.deepEqual(typeLabels, {})
assert.deepEqual(colors, {})
assert.equal(formatRuleId('repo.current-check'), 'Current check')
assert.equal(
  formatRuleId('repo.module-boundary'),
  'Module Boundary',
  'runtime rule labels from a previous graph must not leak into the next project'
)
assert.equal(formatRuleId('frontend.no-any'), 'No any type', 'built-in labels must survive project replacement')
assert.equal(formatModule('order-management'), 'Order Management')
assert.equal(formatLayer('backend-service'), 'Backend Service')
assert.equal(formatType('main-component'), 'Main Component')

console.log('viewer project map presentation tests passed')
