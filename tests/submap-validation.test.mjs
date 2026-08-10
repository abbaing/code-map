import assert from 'node:assert/strict'
import { createSubmap, validateSubmap, validateSubmapAgainstGraph } from '#submap/index.mjs'

const graph = fixtureGraph()
const validSubmap = createSubmap(
  graph,
  {
    id: 'validation-fixture',
    selectors: { nodeIds: ['node:a'] },
    traversal: { direction: 'outgoing', maxDepth: 1 }
  },
  { createdAt: '2030-01-02T03:04:05.000Z' }
)

assert.equal(validateSubmap(validSubmap).valid, true)

for (const [field, value, expectedCode] of [
  ['source', null, 'SUBMAP_SOURCE_MISSING'],
  ['selection', [], 'SUBMAP_SELECTION_MISSING'],
  ['access', null, 'SUBMAP_ACCESS_MISSING'],
  ['catalog', null, 'SUBMAP_CATALOG_MISSING'],
  ['statistics', null, 'SUBMAP_STATISTICS_MISSING'],
  ['metadata', null, 'SUBMAP_METADATA_MISSING'],
  ['nodes', {}, 'SUBMAP_INVALID_NODES'],
  ['edges', null, 'SUBMAP_INVALID_EDGES'],
  ['findings', {}, 'SUBMAP_INVALID_FINDINGS'],
  ['orphanNodeIds', null, 'SUBMAP_INVALID_ORPHANS'],
  ['boundaries', {}, 'SUBMAP_INVALID_BOUNDARIES'],
  ['warnings', null, 'SUBMAP_INVALID_WARNINGS']
]) {
  const malformed = structuredClone(validSubmap)
  malformed[field] = value
  assert.equal(validationCodes(malformed).has(expectedCode), true, `${field} must return ${expectedCode}`)
}

assert.equal(validationCodes(null).has('SUBMAP_INVALID_DOCUMENT'), true)
assert.equal(validationCodes([]).has('SUBMAP_INVALID_DOCUMENT'), true)

const futureVersion = structuredClone(validSubmap)
futureVersion.schemaVersion = 2
assert.equal(validationCodes(futureVersion).has('SUBMAP_SCHEMA_INCOMPATIBLE'), true)

const invalidCreatedAt = structuredClone(validSubmap)
invalidCreatedAt.createdAt = 1_893_554_645_000
assert.equal(validationCodes(invalidCreatedAt).has('SUBMAP_INVALID_CREATED_AT'), true)

const invalidDigest = structuredClone(validSubmap)
invalidDigest.source.graphDigest = 'sha256:short'
assert.equal(validationCodes(invalidDigest).has('SUBMAP_SOURCE_DIGEST_MISSING'), true)

const invalidSeeds = structuredClone(validSubmap)
invalidSeeds.selection.resolvedSeedNodeIds = null
assert.equal(validationCodes(invalidSeeds).has('SUBMAP_INVALID_RESOLVED_SEEDS'), true)

const malformedItems = [
  ['edges', null, 'SUBMAP_INVALID_EDGE_ID'],
  ['findings', null, 'SUBMAP_INVALID_FINDING'],
  ['orphanNodeIds', null, 'SUBMAP_INVALID_ORPHAN_NODE_ID'],
  ['boundaries', null, 'SUBMAP_INVALID_BOUNDARY']
]
for (const [field, value, expectedCode] of malformedItems) {
  const malformed = structuredClone(validSubmap)
  malformed[field] = [value]
  assert.doesNotThrow(() => validateSubmap(malformed))
  assert.equal(validationCodes(malformed).has(expectedCode), true)
}

const invalidEndpoint = structuredClone(validSubmap)
delete invalidEndpoint.edges[0].to
assert.equal(validationCodes(invalidEndpoint).has('SUBMAP_INVALID_EDGE_ENDPOINT'), true)

const missingEndpoint = structuredClone(validSubmap)
missingEndpoint.edges[0].to = 'node:missing'
assert.equal(validationCodes(missingEndpoint).has('SUBMAP_EDGE_ENDPOINT_MISSING'), true)

const duplicateNode = structuredClone(validSubmap)
duplicateNode.nodes.push(structuredClone(duplicateNode.nodes[0]))
assert.equal(validationCodes(duplicateNode).has('SUBMAP_DUPLICATE_NODE_ID'), true)

const duplicateEdge = structuredClone(validSubmap)
duplicateEdge.edges.push(structuredClone(duplicateEdge.edges[0]))
assert.equal(validationCodes(duplicateEdge).has('SUBMAP_DUPLICATE_EDGE_ID'), true)

const accessConflict = structuredClone(validSubmap)
accessConflict.access.editable.push(accessConflict.access.readable[0])
assert.equal(validationCodes(accessConflict).has('SUBMAP_ACCESS_CONFLICT'), true)

assert.doesNotThrow(() => validateSubmapAgainstGraph(null, graph))
assert.equal(validateSubmapAgainstGraph(null, graph).valid, false)
assert.equal(
  validateSubmapAgainstGraph(validSubmap, { nodes: null, edges: [] }).errors.some(
    (issue) => issue.code === 'SUBMAP_INVALID_GRAPH'
  ),
  true
)

const changedGraph = structuredClone(graph)
changedGraph.nodes[0].label = 'Changed source node'
const changedResult = validateSubmapAgainstGraph(validSubmap, changedGraph)
assert.equal(
  changedResult.errors.some((issue) => issue.code === 'SUBMAP_GRAPH_DIGEST_MISMATCH'),
  true
)
assert.equal(
  changedResult.warnings.some((issue) => issue.code === 'SUBMAP_SOURCE_NODE_CHANGED'),
  true
)

const missingSourceGraph = structuredClone(graph)
missingSourceGraph.nodes = []
missingSourceGraph.edges = []
const missingSourceResult = validateSubmapAgainstGraph(validSubmap, missingSourceGraph)
assert.equal(
  missingSourceResult.errors.some((issue) => issue.code === 'SUBMAP_SOURCE_NODE_MISSING'),
  true
)
assert.equal(
  missingSourceResult.errors.some((issue) => issue.code === 'SUBMAP_SOURCE_EDGE_MISSING'),
  true
)

console.log('submap validation tests passed')

function validationCodes(submap) {
  return new Set(validateSubmap(submap).errors.map((issue) => issue.code))
}

function fixtureGraph() {
  const nodes = [
    { id: 'node:a', label: 'Node A', type: 'service', layer: 'application', module: 'demo', meta: {} },
    { id: 'node:b', label: 'Node B', type: 'repository', layer: 'infrastructure', module: 'demo', meta: {} }
  ]
  const edges = [
    {
      id: 'node:a::calls::node:b',
      from: 'node:a',
      to: 'node:b',
      type: 'calls',
      label: 'calls',
      confidence: 'high',
      source: 'fixture'
    }
  ]
  return {
    version: 1,
    generatedAt: '2030-01-01T00:00:00.000Z',
    projectMap: { project: { name: 'Validation Fixture' }, modules: { labels: {} }, layers: [], types: {} },
    nodes,
    edges,
    findings: [],
    suppressedFindings: [],
    orphans: [],
    templates: [],
    architecture: [],
    ruleMetadata: {}
  }
}
