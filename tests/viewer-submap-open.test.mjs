import assert from 'node:assert/strict'
import { createElement } from '#tests/viewer-interaction-fixture.mjs'
import { configureViewerData } from '#viewer/viewer-data.js'
import { bindSubmapNavigation } from '#viewer/viewer-interaction-submaps.mjs'
import { configureViewerElements, state } from '#viewer/viewer-state.js'
import { closeSubmapPreview, currentNodeIds, openSubmap, previewSubmap } from '#viewer/viewer-submaps.js'

const uid = `sha256:${'a'.repeat(64)}`
const parentUid = `sha256:${'b'.repeat(64)}`
const submap = {
  uid,
  id: 'checkout-flow',
  revision: 2,
  parentUid,
  metadata: { name: 'Checkout flow' },
  nodes: [
    { id: 'page:checkout', label: 'Checkout <page>', type: 'page' },
    { id: 'api:checkout', label: 'Checkout API', type: 'endpoint' },
    { id: 'removed:node', label: 'Removed', type: 'component' }
  ],
  edges: [],
  boundaries: []
}
const parent = {
  ...submap,
  uid: parentUid,
  revision: 1,
  parentUid: undefined,
  nodes: [submap.nodes[0], { id: 'legacy:checkout', label: 'Legacy checkout', type: 'page' }]
}
let loads = 0
let parentAvailable = true
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
    assert.equal([uid, parentUid].includes(requestedUid), true)
    if (requestedUid === parentUid && !parentAvailable) {
      throw new Error('missing parent')
    }
    return { submap: requestedUid === uid ? submap : parent }
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
elements.toast = createElement()
configureViewerElements(elements)
globalThis.window = { clearTimeout() {}, setTimeout() {} }
Object.assign(state, {
  view: 'submaps',
  graph: { nodes: [{ id: 'page:checkout' }, { id: 'api:checkout' }] },
  subgraphNodeIds: new Set(),
  fitView: false,
  activeSubmap: null,
  submaps: [
    { id: submap.id, uid, revision: 2, createdAt: '2030-01-02T00:00:00.000Z' },
    { id: submap.id, uid: parentUid, revision: 1, createdAt: '2030-01-01T00:00:00.000Z' }
  ]
})

assert.equal(await openSubmap(uid), true)
assert.deepEqual([...state.subgraphNodeIds], ['page:checkout', 'api:checkout'])
assert.deepEqual([...state.activeSubmap.nodeIds], ['page:checkout', 'api:checkout'])
assert.equal(state.activeSubmap.revision, 2)
assert.equal(elements.selectionNameInput.value, 'Checkout flow')
assert.equal(state.fitView, true)
assert.match(elements.toast.textContent, /1 unavailable nodes were omitted/u)
assert.deepEqual(currentNodeIds(submap, state.graph), ['page:checkout', 'api:checkout'])

assert.equal(await previewSubmap(uid), true)
assert.equal(elements.submapPreviewTitle.textContent, 'Checkout flow')
assert.match(elements.submapPreviewBody.innerHTML, /Checkout &lt;page&gt;/u)
assert.match(elements.submapPreviewBody.innerHTML, /Changes from r1/u)
assert.match(elements.submapPreviewBody.innerHTML, /\+2 nodes/u)
assert.match(elements.submapPreviewBody.innerHTML, /1 unavailable nodes/u)
assert.equal(elements.submapPreviewOpenBtn.disabled, false)
assert.match(elements.submapPreviewBody.innerHTML, /−1 nodes/u)
assert.equal(elements.submapPreviewOpenBtn.dataset.submapUid, uid)
closeSubmapPreview()
assert.equal(state.previewSubmap, null)
assert.equal(elements.submapPreview.classList.contains('hidden'), true)
await previewSubmap(uid)
parentAvailable = false
assert.equal(await previewSubmap(uid), true)
assert.match(elements.submapPreviewBody.innerHTML, /Parent revision is unavailable/u)

const submapList = createElement()
const views = []
const previewed = []
bindSubmapNavigation(
  {
    elements: {
      submapList,
      submapPreviewBody: elements.submapPreviewBody,
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
await elements.submapPreviewBody.dispatch('click', {
  target: { closest: () => ({ dataset: { submapRevisionUid: parentUid } }) }
})
assert.deepEqual(previewed, [uid, parentUid])
await elements.submapPreviewOpenBtn.dispatch('click', {})
assert.deepEqual(views, ['graph'])
assert.equal(loads, 7, 'opening the previewed revision must reuse the loaded document')

state.graph = { nodes: [] }
assert.equal(await openSubmap(uid), false)
assert.match(elements.toast.textContent, /None of this Submap’s nodes exist/u)

console.log('viewer submap opening tests passed')
