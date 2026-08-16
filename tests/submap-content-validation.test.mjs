import assert from 'node:assert/strict'
import { createSubmap } from '#submap/index.mjs'
import { validateSubmapContent } from '#submap/validation-content.mjs'
import { fixtureGraph } from '#tests/submap-fixture.mjs'

const validSubmap = createSubmap(
  fixtureGraph(),
  {
    id: 'content-validation',
    selectors: { nodeIds: ['auth:service'] },
    traversal: { direction: 'outgoing', maxDepth: 1 }
  },
  { createdAt: '2030-01-02T03:04:05.000Z' }
)

function validateMutation(mutate) {
  const submap = structuredClone(validSubmap)
  mutate(submap)
  const errors = []
  validateSubmapContent(submap, errors)
  return errors
}

function codes(errors) {
  return new Set(errors.map((error) => error.code))
}

const invalidIds = validateMutation((submap) => {
  submap.nodes.push({ label: 'Missing node id' })
  submap.edges.push({ from: 'auth:service', to: 'auth:repo' })
})
assert.equal(codes(invalidIds).has('SUBMAP_INVALID_NODE_ID'), true)
assert.equal(codes(invalidIds).has('SUBMAP_INVALID_EDGE_ID'), true)

const missingFinding = validateMutation((submap) => {
  submap.findings.push({ id: 'finding:missing', nodeId: 'missing' })
})
assert.deepEqual(missingFinding.find((issue) => issue.code === 'SUBMAP_FINDING_NODE_MISSING').details, {
  findingId: 'finding:missing',
  nodeId: 'missing'
})

const orphanErrors = validateMutation((submap) => {
  submap.orphanNodeIds.push(42, 'missing')
})
assert.equal(codes(orphanErrors).has('SUBMAP_INVALID_ORPHAN_NODE_ID'), true)
assert.equal(codes(orphanErrors).has('SUBMAP_ORPHAN_NODE_MISSING'), true)

const boundaryErrors = validateMutation((submap) => {
  const boundary = submap.boundaries[0]
  boundary.insideNodeId = 'missing'
  boundary.edgeId = submap.edges[0].id
  boundary.outsideNode = structuredClone(submap.nodes[0])
})
assert.equal(codes(boundaryErrors).has('SUBMAP_BOUNDARY_NODE_MISSING'), true)
assert.equal(codes(boundaryErrors).has('SUBMAP_BOUNDARY_EDGE_INCLUDED'), true)
assert.equal(codes(boundaryErrors).has('SUBMAP_BOUNDARY_OUTSIDE_INCLUDED'), true)

const seedErrors = validateMutation((submap) => {
  submap.selection.resolvedSeedNodeIds.push('missing')
})
assert.deepEqual(seedErrors.find((issue) => issue.code === 'SUBMAP_SEED_NODE_MISSING').details, {
  nodeId: 'missing'
})

const invalidDefault = validateMutation((submap) => {
  submap.access.default = 'owner'
})
assert.deepEqual(invalidDefault.find((issue) => issue.code === 'SUBMAP_ACCESS_DEFAULT_INVALID').details, {
  access: 'owner'
})

const invalidAccess = validateMutation((submap) => {
  submap.access.editable = 'auth:service'
})
assert.equal(codes(invalidAccess).has('SUBMAP_ACCESS_INVALID'), true)

const missingAccessNode = validateMutation((submap) => {
  submap.access.readable.push('missing')
})
assert.equal(codes(missingAccessNode).has('SUBMAP_ACCESS_NODE_MISSING'), true)

const unclassified = validateMutation((submap) => {
  for (const level of ['editable', 'readable', 'forbidden', 'generated', 'external']) {
    submap.access[level] = submap.access[level].filter((id) => id !== 'auth:service')
  }
})
assert.deepEqual(unclassified.find((issue) => issue.code === 'SUBMAP_ACCESS_UNCLASSIFIED').details, {
  nodeId: 'auth:service'
})

const statisticsErrors = validateMutation((submap) => {
  submap.statistics.nodes = 99
  submap.statistics.readable = 99
})
assert.deepEqual(
  statisticsErrors.filter((issue) => issue.code === 'SUBMAP_STATISTICS_MISMATCH').map((issue) => issue.details.field),
  ['nodes', 'readable']
)

console.log('submap content validation tests passed')
