import assert from 'node:assert/strict'
import { createElement } from '#tests/viewer-interaction-fixture.mjs'
import { configureViewerData } from '#viewer/viewer-data.js'
import { bindSubmapNavigation } from '#viewer/viewer-interaction-submaps.mjs'
import { configureViewerElements, state } from '#viewer/viewer-state.js'
import { closeSubmapPreview, currentNodeIds, openSubmap, previewSubmap } from '#viewer/viewer-submaps.js'

const uid = `sha256:${'a'.repeat(64)}`
const submap = {
  uid,
  id: 'checkout-flow',
  revision: 2,
  metadata: { name: 'Checkout flow' },
  nodes: [
    { id: 'page:checkout', label: 'Checkout <page>', type: 'page' },
    { id: 'api:checkout', label: 'Checkout API', type: 'endpoint' },
    { id: 'removed:node', label: 'Removed', type: 'component' }
  ],
  edges: [],
  boundaries: []
}
let loads = 0
const gateway = {
  loadGraph() {},
  scan() {},
  updateProjectMap() {},
  listSubmaps() {},
  createTraceSubmap() {},
  createSelectionSubmap() {},
  reviseSubmap() {},
  async loadSubmap(requestedUid) {
    loads += 1
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
Object.assign(elements, {
  submapPreview: createElement(),
  submapPreviewTitle: createElement(),
  submapPreviewMeta: createElement(),
  submapPreviewBody: createElement(),
  submapPreviewOpenBtn: createElement(),
  submapPreviewCloseBtn: createElement()
})
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

assert.equal(await previewSubmap(uid), true)
assert.equal(elements.submapPreviewTitle.textContent, 'Checkout flow')
assert.match(elements.submapPreviewBody.innerHTML, /Checkout &lt;page&gt;/u)
assert.equal(elements.submapPreviewOpenBtn.dataset.submapUid, uid)
closeSubmapPreview()
assert.equal(state.previewSubmap, null)
assert.equal(elements.submapPreview.classList.contains('hidden'), true)
await previewSubmap(uid)

const submapList = createElement()
const views = []
const previewed = []
bindSubmapNavigation(
  {
    elements: {
      submapList,
      submapPreviewOpenBtn: elements.submapPreviewOpenBtn,
      submapPreviewCloseBtn: elements.submapPreviewCloseBtn
    },
    operations: {
      previewSubmap: async (requestedUid) => previewed.push(requestedUid),
      openSubmap: async (requestedUid) => requestedUid === uid,
      closeSubmapPreview() {}
    }
  },
  (view) => views.push(view)
)
await submapList.dispatch('click', {
  target: { closest: () => ({ dataset: { submapUid: uid } }) }
})
assert.deepEqual(views, [])
assert.deepEqual(previewed, [uid])
await elements.submapPreviewOpenBtn.dispatch('click', {})
assert.deepEqual(views, ['graph'])
assert.equal(loads, 3, 'opening the previewed revision must reuse the loaded document')

console.log('viewer submap opening tests passed')
