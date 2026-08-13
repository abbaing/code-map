import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { Graph, validateGraphDocument } from '#core/graph.mjs'
import { createProjectContext, normalizeProjectMap } from '#core/config.mjs'
import { nodePlatform } from '#platform/node.mjs'

const graph = new Graph()
graph.addNode('a', { label: 'A', type: 'service', meta: { first: true } })
graph.addNode('a', { layer: 'application', meta: { second: true } })
graph.addNode('b', { label: 'B' })

assert.deepEqual(
  graph.getNode('a'),
  {
    id: 'a',
    label: 'A',
    type: 'service',
    layer: 'application',
    module: 'shared',
    path: undefined,
    meta: { first: true, second: true }
  },
  'repeated node discoveries must merge metadata without losing classification'
)

graph.addEdge('a', 'b', 'imports', { confidence: 'high', source: 'test', evidence: './dependency.js' })
graph.addEdge('a', 'b', 'imports', { confidence: 'low', source: 'duplicate' })
graph.addEdge('a', 'a', 'imports')
graph.addEdge('a', 'missing', 'imports')
graph.addEdge('', 'b', 'imports')
assert.equal(graph.allEdges().length, 1, 'edges must be unique, non-self-referential, and connect existing nodes')
assert.equal(graph.getEdge('a::imports::b').confidence, 'high', 'a duplicate edge must not replace its first evidence')
assert.equal(graph.getEdge('a::imports::b').source, 'test', 'edges must retain their provenance')
assert.equal(graph.getEdge('a::imports::b').evidence, './dependency.js', 'edges must retain their evidence')

const validGraphDocument = {
  version: 1,
  generatedAt: '2030-01-02T03:04:05.000Z',
  stats: { nodes: 2, edges: 1 },
  nodes: graph.allNodes(),
  edges: graph.allEdges()
}
assert.equal(validateGraphDocument(validGraphDocument), validGraphDocument)
assert.throws(() => validateGraphDocument(null), /Graph document must be an object/u)
assert.throws(
  () => validateGraphDocument({ ...validGraphDocument, version: 2 }),
  /Only graph document version 1 is supported/u,
  'future graph versions must require an explicit compatibility decision'
)
assert.throws(
  () => validateGraphDocument({ version: 1, generatedAt: '2030-01-02T03:04:05.000Z', stats: {} }),
  (error) =>
    ['nodes must be an array', 'edges must be an array'].every((message) => error.message.includes(message)) &&
    error.issues.length === 2,
  'graph validation must report missing collections together'
)
assert.throws(
  () =>
    validateGraphDocument({
      version: 0,
      generatedAt: 'not-a-date',
      stats: { nodes: 1, edges: -1 },
      nodes: [
        { id: 'a', label: '', type: 'service', layer: 'application', module: 'shared' },
        { id: 'a', label: 'Duplicate', type: 'service', layer: 'application', module: 'shared' }
      ],
      edges: [
        { id: 'wrong', from: 'a', to: 'missing', type: 'imports' },
        { id: 'wrong', from: 'missing', to: 'a', type: '' },
        null
      ]
    }),
  (error) =>
    [
      'Only graph document version 1 is supported',
      'generatedAt must be a valid date-time string',
      'stats.nodes must equal 2',
      'stats.edges must be a non-negative integer',
      'nodes[0].label must be a non-empty string',
      'nodes[1].id duplicates node a',
      'edges[0].to references missing node missing',
      'edges[0].id must match its endpoints and type',
      'edges[1].id duplicates edge wrong',
      'edges[1].from references missing node missing',
      'edges[2] must be an object'
    ].every((message) => error.message.includes(message)),
  'graph validation must aggregate identity, count, and topology errors'
)

graph.clear()
assert.deepEqual([graph.allNodes().length, graph.allEdges().length], [0, 0], 'clear must reset both graph indexes')

assert.equal(
  normalizeProjectMap({ project: { name: 'Default Output' }, sourceRoots: { frontend: 'src' } }).project.graphOutput,
  '.code-map/graph.json',
  'normalized configs without an explicit output must default below .code-map'
)

const mutableInput = {
  schemaVersion: 1,
  project: { name: 'Immutable Context', graphOutput: 'graph.json' },
  sourceRoots: { frontend: 'src' },
  modules: { shared: 'shared' }
}
const firstContext = createProjectContext(mutableInput, {
  repoRoot: path.join(os.tmpdir(), 'context-one'),
  configPath: 'config/project-map.json',
  platform: nodePlatform
})
const secondContext = createProjectContext(
  {
    schemaVersion: 1,
    project: { name: 'Independent Context' },
    sourceRoots: { frontend: 'client' },
    modules: { shared: 'common' }
  },
  { repoRoot: path.join(os.tmpdir(), 'context-two'), platform: nodePlatform }
)
mutableInput.project.name = 'Mutated Input'
assert.equal(firstContext.projectMap.project.name, 'Immutable Context', 'contexts must clone their configuration input')
assert.equal(Object.isFrozen(firstContext), true, 'the context boundary must be immutable')
assert.equal(Object.isFrozen(firstContext.projectMap.modules), true, 'nested configuration must be immutable')
assert.throws(
  () => {
    firstContext.projectMap.modules.shared = 'changed'
  },
  TypeError,
  'configuration mutation must fail immediately'
)
assert.equal(secondContext.projectMap.modules.shared, 'common', 'contexts must not share configuration state')
assert.equal(
  firstContext.resolveGraphOutputPath(),
  path.join(os.tmpdir(), 'context-one', 'config', 'graph.json'),
  'bare graph outputs must resolve beside an explicit project map'
)
assert.equal(
  secondContext.resolveRepoPath('client/index.ts'),
  path.join(os.tmpdir(), 'context-two', 'client', 'index.ts'),
  'repository paths must resolve against their own context root'
)

console.log('core graph and configuration tests passed')
