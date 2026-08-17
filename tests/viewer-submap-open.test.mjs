import assert from 'node:assert/strict'
import { createElement } from '#tests/viewer-interaction-fixture.mjs'
import { configureViewerData } from '#viewer/viewer-data.js'
import { bindSubmapNavigation } from '#viewer/viewer-interaction-submaps.mjs'
import { configureViewerElements, state } from '#viewer/viewer-state.js'
import { currentNodeIds, openSubmap } from '#viewer/viewer-submaps.js'

const uid = `sha256:${'a'.repeat(64)}`
const submap = {
  uid,
  id: 'checkout-flow',
  revision: 2,
  metadata: { name: 'Checkout flow' },
  nodes: [{ id: 'page:checkout' }, { id: 'api:checkout' }, { id: 'removed:node' }]
}
const gateway = {
  loadGraph() {},
  scan() {},
  updateProjectMap() {},
  listSubmaps() {},
  createTraceSubmap() {},
  createSelectionSubmap() {},
  reviseSubmap() {},
  async loadSubmap(requestedUid) {
    assert.equal(requestedUid, uid)
    return { submap }
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
const elements = {
  selectionNameInput: createElement(),
  selectionBar: createElement(),
  selectionCount: createElement(),
  selectionState: createElement(),
  selectionCreateBtn: createElement(),
  selectionSaveBtn: createElement(),
  selectionDiscardBtn: createElement()
}
configureViewerElements(elements)
Object.assign(state, {
  view: 'submaps',
  graph: { nodes: [{ id: 'page:checkout' }, { id: 'api:checkout' }] },
  subgraphNodeIds: new Set(),
  fitView: false,
  activeSubmap: null
})

assert.equal(await openSubmap(uid), true)
assert.deepEqual([...state.subgraphNodeIds], ['page:checkout', 'api:checkout'])
assert.deepEqual([...state.activeSubmap.nodeIds], ['page:checkout', 'api:checkout'])
assert.equal(state.activeSubmap.revision, 2)
assert.equal(elements.selectionNameInput.value, 'Checkout flow')
assert.equal(state.fitView, true)
assert.deepEqual(currentNodeIds(submap, state.graph), ['page:checkout', 'api:checkout'])

const submapList = createElement()
const views = []
bindSubmapNavigation(
  { elements: { submapList }, operations: { openSubmap: async (requestedUid) => requestedUid === uid } },
  (view) => views.push(view)
)
await submapList.dispatch('click', {
  target: { closest: () => ({ dataset: { submapUid: uid } }) }
})
assert.deepEqual(views, ['graph'])

console.log('viewer submap opening tests passed')
