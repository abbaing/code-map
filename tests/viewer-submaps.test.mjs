import assert from 'node:assert/strict'
import { configureViewerElements, state } from '#viewer/viewer-state.js'
import { renderSubmaps, submapRowHtml } from '#viewer/viewer-submaps.js'

const submap = {
  id: 'payments',
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
state.submaps = [
  submap,
  { ...submap, revision: 1, uid: 'sha256:payments-r1' },
  { ...submap, id: 'orders', name: 'orders', uid: 'sha256:orders', file: 'orders.submap.json' }
]

renderSubmaps()
assert.match(elements.submapList.innerHTML, /&lt;payments&gt;/u)
assert.match(elements.submapList.innerHTML, /4 components/u)
assert.match(elements.submapList.innerHTML, /2 saved versions/u)
assert.match(elements.submapList.innerHTML, /Manual selection/u)
assert.doesNotMatch(elements.submapList.innerHTML, /3 relationships/u)
assert.doesNotMatch(elements.submapList.innerHTML, /payments\.submap\.json/u)
assert.doesNotMatch(elements.submapList.innerHTML, /payments-r1/u)
assert.doesNotMatch(submapRowHtml(submap), /<payments>/u)
const invalidRow = submapRowHtml({
  status: 'invalid',
  name: '<broken>',
  file: 'broken.submap.json',
  issue: { message: 'Invalid <JSON>' }
})
assert.match(invalidRow, /Invalid &lt;JSON&gt;/u)
assert.doesNotMatch(invalidRow, /data-submap-uid/u)

elements.submapSearch.value = 'orders'
renderSubmaps()
assert.doesNotMatch(elements.submapList.innerHTML, /payments/u)
assert.match(elements.submapList.innerHTML, /orders/u)

elements.submapSearch.value = 'missing'
renderSubmaps()
assert.match(elements.submapList.innerHTML, /No named submaps/u)

console.log('viewer submap presentation tests passed')
