import assert from 'node:assert/strict'
import { submapAvailability } from '#viewer/viewer-submap-availability.js'
import { compareSubmapRevisions, latestSubmapRevisions, revisionsForSubmap } from '#viewer/viewer-submap-revisions.js'
import { submapPreviewHtml } from '#viewer/viewer-submap-preview.js'

const summaries = [
  { id: 'checkout', uid: 'r1', revision: 1, createdAt: '2030-01-01T00:00:00.000Z' },
  { id: 'orders', uid: 'o1', revision: 1, createdAt: '2030-01-01T00:00:00.000Z' },
  { id: 'checkout', uid: 'r3', revision: 3, createdAt: '2030-01-03T00:00:00.000Z' },
  { id: 'checkout', uid: 'r2', revision: 2, createdAt: '2030-01-02T00:00:00.000Z' }
]

assert.deepEqual(
  revisionsForSubmap(summaries, 'checkout').map(({ uid }) => uid),
  ['r3', 'r2', 'r1']
)
assert.deepEqual(
  latestSubmapRevisions(summaries).map(({ uid, revisionCount }) => [uid, revisionCount]),
  [
    ['r3', 3],
    ['o1', 1]
  ]
)

const parent = {
  nodes: [{ id: 'shared' }, { id: 'removed' }],
  edges: [{ id: 'shared-edge' }, { id: 'removed-edge' }]
}
const current = {
  nodes: [{ id: 'shared' }, { id: 'added' }],
  edges: [{ id: 'shared-edge' }, { id: 'added-edge' }]
}
const difference = compareSubmapRevisions(current, parent)
assert.deepEqual(
  difference.addedNodes.map(({ id }) => id),
  ['added']
)
assert.deepEqual(
  difference.removedNodes.map(({ id }) => id),
  ['removed']
)
assert.deepEqual(
  difference.addedEdges.map(({ id }) => id),
  ['added-edge']
)
assert.deepEqual(
  difference.removedEdges.map(({ id }) => id),
  ['removed-edge']
)
assert.equal(Object.isFrozen(difference), true)
const initial = { ...parent, id: 'checkout', uid: 'r1', revision: 1 }
const availability = submapAvailability(initial, { nodes: initial.nodes })
assert.match(submapPreviewHtml(initial, null, summaries, availability), /Initial revision/u)

console.log('viewer submap revision tests passed')
