import assert from 'node:assert/strict'
import { createSelectionSubmap } from '#viewer/viewer-actions.js'
import { selectedGraph } from '#viewer/viewer-actions-graph.js'
import { configureViewerData } from '#viewer/viewer-data.js'
import { configureViewerElements, state } from '#viewer/viewer-state.js'
import { createElement } from '#tests/viewer-interaction-fixture.mjs'

const requests = []
const gateway = {
  loadGraph() {},
  scan() {},
  updateProjectMap() {},
  listSubmaps() {},
  createTraceSubmap() {},
  async createSelectionSubmap(request) {
    requests.push(request)
    return { ok: true, file: 'checkout-flow.submap.json' }
  }
}
configureViewerData({
  gateway,
  operations: Object.fromEntries(
    [
      'hidePopover',
      'initializeFindingsFilters',
      'renderFindings',
      'renderGraph',
      'renderModuleDetail',
      'renderOverview'
    ].map((name) => [name, () => {}])
  )
})
const selectionBar = createElement()
const toast = createElement()
Object.assign(toast, { textContent: '' })
const elements = {
  selectionNameInput: { value: 'Checkout flow' },
  selectionCreateBtn: { disabled: false },
  selectionBar,
  selectionCount: { textContent: '' },
  toast
}
configureViewerElements(elements)
Object.assign(state, { view: 'overview', subgraphNodeIds: new Set(['page:checkout', 'api:checkout']) })
globalThis.window = { clearTimeout() {}, setTimeout() {} }

await createSelectionSubmap()

assert.deepEqual(requests, [{ name: 'Checkout flow', nodeIds: ['page:checkout', 'api:checkout'] }])
assert.equal(state.subgraphNodeIds.size, 0)
assert.equal(elements.selectionNameInput.value, '')
assert.equal(elements.selectionCreateBtn.disabled, false)
assert.match(toast.textContent, /checkout-flow\.submap\.json/u)

const projected = selectedGraph(
  {
    nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    edges: [
      { id: 'a:b', from: 'a', to: 'b' },
      { id: 'b:c', from: 'b', to: 'c' }
    ],
    findings: [
      { id: 'finding:a', nodeId: 'a' },
      { id: 'finding:c', nodeId: 'c' }
    ],
    orphans: [{ id: 'b' }, { id: 'c' }],
    stats: { nodes: 3, edges: 2, findings: 2 }
  },
  new Set(['a', 'b'])
)
assert.deepEqual(projected.stats, { nodes: 2, edges: 1, findings: 1 })
assert.deepEqual(
  projected.nodes.map(({ id }) => id),
  ['a', 'b']
)
assert.deepEqual(
  projected.edges.map(({ id }) => id),
  ['a:b']
)
assert.deepEqual(
  projected.orphans.map(({ id }) => id),
  ['b']
)

console.log('viewer selection action tests passed')
