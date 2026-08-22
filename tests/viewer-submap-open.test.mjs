import assert from 'node:assert/strict'
import { createElement } from '#tests/viewer-interaction-fixture.mjs'
import { configureViewerData } from '#viewer/viewer-data.js'
import { bindSubmapNavigation } from '#viewer/viewer-interaction-submaps.mjs'
import { configureViewerElements, state } from '#viewer/viewer-state.js'
import { currentNodeIds, deleteSubmap, openSubmap, submapRowHtml } from '#viewer/viewer-submaps.js'

const uid = `sha256:${'a'.repeat(64)}`
const submap = {
  uid,
  id: 'checkout-flow',
  revision: 2,
  metadata: { name: 'Checkout flow' },
  nodes: [
    { id: 'page:checkout', label: 'Checkout page', type: 'page' },
    { id: 'api:checkout', label: 'Checkout API', type: 'endpoint' },
    { id: 'removed:node', label: 'Removed', type: 'component' }
  ],
  edges: [],
  boundaries: []
}
let deletedUid
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
  },
  async deleteSubmap(requestedUid) {
    deletedUid = requestedUid
    return { id: submap.id, deleted: 2 }
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
  selectionDiscardBtn: createElement(),
  submapList: createElement(),
  submapSearch: createElement(),
  toast: createElement()
}
configureViewerElements(elements)
globalThis.window = { clearTimeout() {}, setTimeout() {} }
Object.assign(state, {
  view: 'submaps',
  graph: { nodes: [{ id: 'page:checkout' }, { id: 'api:checkout' }] },
  subgraphNodeIds: new Set(),
  fitView: false,
  activeSubmap: null,
  submaps: [
    { id: submap.id, name: 'Checkout flow', uid, revision: 2, createdAt: '2030-01-02T00:00:00.000Z' },
    { id: submap.id, name: 'Checkout flow', uid: 'previous', revision: 1, createdAt: '2030-01-01T00:00:00.000Z' },
    { id: 'orders', name: 'Orders', uid: 'orders', revision: 1, createdAt: '2030-01-01T00:00:00.000Z' }
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

const rowHtml = submapRowHtml({ ...state.submaps[0], kind: 'selection' }, state.submaps.slice(0, 2))
assert.match(rowHtml, /aria-label="Open Checkout flow in graph"/u)
assert.match(rowHtml, /<details class="submap-options">/u)
assert.match(rowHtml, /Delete submap/u)
assert.match(rowHtml, /Open version/u)
assert.match(rowHtml, /data-open-submap-uid="previous"/u)

const views = []
const deleted = []
const navigationDocument = createElement()
bindSubmapNavigation(
  {
    elements: { submapList: elements.submapList },
    document: navigationDocument,
    operations: {
      openSubmap: async (requestedUid) => requestedUid === uid || requestedUid === 'previous',
      deleteSubmap: async (requestedUid) => deleted.push(requestedUid)
    }
  },
  (view) => views.push(view)
)
await elements.submapList.dispatch('click', {
  target: { closest: (selector) => (selector === '[data-submap-uid]' ? { dataset: { submapUid: uid } } : null) }
})
assert.deepEqual(views, ['graph'])
await elements.submapList.dispatch('click', {
  target: {
    closest: (selector) => (selector === '[data-open-submap-uid]' ? { dataset: { openSubmapUid: 'previous' } } : null)
  }
})
assert.deepEqual(views, ['graph', 'graph'])
await elements.submapList.dispatch('click', {
  target: {
    closest: (selector) => (selector === '[data-delete-submap-uid]' ? { dataset: { deleteSubmapUid: uid } } : null)
  }
})
assert.deepEqual(deleted, [uid])
let menuClosed = false
elements.submapList.querySelectorAll = () => [{ removeAttribute: () => (menuClosed = true) }]
await navigationDocument.dispatch('click', { target: { closest: () => null } })
assert.equal(menuClosed, true)

assert.equal(await deleteSubmap(uid, () => false), false)
assert.equal(deletedUid, undefined)
assert.equal(await deleteSubmap(uid, () => true), true)
assert.equal(deletedUid, uid)
assert.equal(state.activeSubmap, null)
assert.deepEqual(
  state.submaps.map(({ id }) => id),
  ['orders']
)

state.graph = { nodes: [] }
assert.equal(await openSubmap(uid), false)
assert.match(elements.toast.textContent, /None of this Submap/u)

console.log('viewer submap opening tests passed')
