import assert from 'node:assert/strict'
import { submapAvailability } from '#viewer/viewer-submap-availability.js'

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

const unavailable = submapAvailability(submap, { nodes: [] })
assert.equal(unavailable.availableNodes.length, 0)
assert.equal(unavailable.missingNodes.length, 2)

console.log('viewer submap recovery tests passed')
