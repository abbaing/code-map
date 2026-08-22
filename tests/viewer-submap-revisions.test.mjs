import assert from 'node:assert/strict'
import { latestSubmapRevisions, revisionsForSubmap } from '#viewer/viewer-submap-revisions.js'

const summaries = [
  { id: 'checkout', uid: 'r1', revision: 1, createdAt: '2030-01-01T00:00:00.000Z' },
  { id: 'orders', uid: 'o1', revision: 1, createdAt: '2030-01-01T00:00:00.000Z' },
  { id: 'checkout', uid: 'r3', revision: 3, createdAt: '2030-01-03T00:00:00.000Z' },
  { id: 'checkout', uid: 'r2', revision: 2, createdAt: '2030-01-02T00:00:00.000Z' }
]

assert.deepEqual(
  latestSubmapRevisions(summaries).map(({ uid, revisionCount }) => [uid, revisionCount]),
  [
    ['r3', 3],
    ['o1', 1]
  ]
)
assert.deepEqual(
  revisionsForSubmap(summaries, 'checkout').map(({ uid }) => uid),
  ['r3', 'r2', 'r1']
)

console.log('viewer submap revision tests passed')
