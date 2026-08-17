import assert from 'node:assert/strict'
import { submapAvailability } from '#viewer/viewer-submap-availability.js'
import { submapPreviewHtml } from '#viewer/viewer-submap-preview.js'

const submap = {
  id: 'checkout',
  uid: 'sha256:checkout',
  revision: 2,
  nodes: [
    { id: 'available', label: 'Available' },
    { id: 'missing', label: 'Missing' }
  ],
  edges: [],
  boundaries: []
}
const availability = submapAvailability(submap, { nodes: [{ id: 'available' }] })
assert.deepEqual(
  availability.availableNodes.map(({ id }) => id),
  ['available']
)
assert.deepEqual(
  availability.missingNodes.map(({ id }) => id),
  ['missing']
)
assert.equal(Object.isFrozen(availability), true)

const html = submapPreviewHtml(
  submap,
  null,
  [{ id: submap.id, uid: submap.uid, revision: 2 }],
  availability,
  'Parent revision is unavailable.'
)
assert.match(html, /1 unavailable nodes/u)
assert.match(html, /will be omitted when opened/u)
assert.match(html, /Parent revision is unavailable/u)

const unavailable = submapAvailability(submap, { nodes: [] })
assert.match(submapPreviewHtml(submap, null, [], unavailable), /leave nothing available to open/u)

console.log('viewer submap recovery tests passed')
