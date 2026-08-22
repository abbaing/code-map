import assert from 'node:assert/strict'
import { createSelectionSubmap, saveSubmapRevision } from '#viewer/viewer-actions.js'
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
  loadSubmap() {},
  createTraceSubmap() {},
  async reviseSubmap(request) {
    requests.push(request)
    return { file: 'checkout-flow-r2.submap.json', uid: 'sha256:revision', revision: 2 }
  },
  async deleteSubmap() {},
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
  selectionNameInput: Object.assign(createElement(), { value: 'Checkout flow' }),
  selectionCreateBtn: createElement(),
  selectionSaveBtn: createElement(),
  selectionDiscardBtn: createElement(),
  selectionState: createElement(),
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

state.activeSubmap = {
  uid: 'sha256:original',
  revision: 1,
  nodeIds: new Set(['page:checkout']),
  name: 'Checkout flow'
}
state.subgraphNodeIds = new Set(['page:checkout', 'api:checkout'])
await saveSubmapRevision()
assert.deepEqual(requests.at(-1), {
  uid: 'sha256:original',
  nodeIds: ['page:checkout', 'api:checkout']
})
assert.deepEqual([state.activeSubmap.uid, state.activeSubmap.revision], ['sha256:revision', 2])
assert.match(toast.textContent, /revision 2 saved/u)

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
