import assert from 'node:assert/strict'
import { configureViewerElements, state } from '#viewer/viewer-state.js'
import { renderSubmaps, submapRowHtml } from '#viewer/viewer-submaps.js'

const submap = {
  name: '<payments>',
  uid: 'sha256:payments',
  revision: 2,
  createdAt: '2030-01-02T03:04:05.000Z',
  kind: 'selection',
  file: 'payments.submap.json',
  statistics: { nodes: 4, edges: 3 }
}
const elements = { submapSearch: { value: '' }, submapList: { innerHTML: '' } }
configureViewerElements(elements)
state.submaps = [submap, { ...submap, name: 'orders', uid: 'sha256:orders', file: 'orders.submap.json' }]

renderSubmaps()
assert.match(elements.submapList.innerHTML, /&lt;payments&gt;/u)
assert.match(elements.submapList.innerHTML, />4<\/span>/u)
assert.doesNotMatch(submapRowHtml(submap), /<payments>/u)

elements.submapSearch.value = 'orders'
renderSubmaps()
assert.doesNotMatch(elements.submapList.innerHTML, /payments/u)
assert.match(elements.submapList.innerHTML, /orders/u)

elements.submapSearch.value = 'missing'
renderSubmaps()
assert.match(elements.submapList.innerHTML, /No named submaps/u)

console.log('viewer submap presentation tests passed')
