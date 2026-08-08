import assert from 'node:assert/strict'
import {
  SubmapError,
  calculateGraphDigest,
  compareSubmaps,
  createSubmap,
  validateSubmap,
  validateSubmapAgainstGraph
} from '../submap/index.mjs'

const graph = fixtureGraph()

const outgoing = createSubmap(
  graph,
  {
    id: 'outgoing',
    selectors: { nodeIds: ['auth:service'] },
    traversal: { direction: 'outgoing', maxDepth: 1 },
    access: { editable: { nodeIds: ['auth:service'] } }
  },
  { createdAt: '2026-08-05T00:00:00.000Z' }
)

assert.deepEqual(
  outgoing.nodes.map((node) => node.id),
  ['auth:repo', 'auth:service']
)
assert.deepEqual(
  outgoing.edges.map((edge) => edge.id),
  ['auth:service::imports::auth:repo']
)
assert.equal(
  outgoing.boundaries.some((boundary) => boundary.outsideNode.id === 'shared:db'),
  true
)
assert.deepEqual(outgoing.access.editable, ['auth:service'])
assert.deepEqual(outgoing.access.readable, ['auth:repo'])
assert.equal(validateSubmap(outgoing).valid, true)
assert.equal(validateSubmapAgainstGraph(outgoing, graph).valid, true)

const detachedLabel = outgoing.nodes[0].label
graph.nodes.find((node) => node.id === outgoing.nodes[0].id).label = 'Mutated source'
assert.equal(outgoing.nodes[0].label, detachedLabel, 'submaps must not retain references to the source graph')
graph.nodes.find((node) => node.id === outgoing.nodes[0].id).label = detachedLabel

const incoming = createSubmap(graph, {
  id: 'incoming',
  selectors: { nodeIds: ['auth:repo'] },
  traversal: { direction: 'incoming', maxDepth: 1 }
})
assert.deepEqual(
  incoming.nodes.map((node) => node.id),
  ['auth:service', 'auth:repo'].sort()
)

const pathSelected = createSubmap(graph, {
  id: 'path-selected',
  selectors: { paths: ['src/auth/**'] },
  traversal: { maxDepth: 0 }
})
assert.deepEqual(
  pathSelected.nodes.map((node) => node.id),
  ['auth:repo', 'auth:service', 'ui:route']
)

const attributeSelected = createSubmap(graph, {
  id: 'attribute-selected',
  selectors: { modules: ['auth'], layers: ['application'], types: ['service'] },
  traversal: { maxDepth: 0 }
})
assert.deepEqual(
  attributeSelected.nodes.map((node) => node.id),
  ['auth:service']
)

const excluded = createSubmap(graph, {
  id: 'excluded',
  selectors: { nodeIds: ['auth:service'] },
  traversal: { direction: 'outgoing', maxDepth: 3 },
  exclusions: { modules: ['billing'] }
})
assert.equal(
  excluded.nodes.some((node) => node.module === 'billing'),
  false
)
assert.equal(
  excluded.boundaries.some((boundary) => boundary.reason === 'excluded' && boundary.outsideNode.module === 'billing'),
  true
)

const edgeFiltered = createSubmap(graph, {
  id: 'edge-filtered',
  selectors: { nodeIds: ['auth:service'] },
  traversal: { direction: 'both', maxDepth: 3, edgeTypes: ['calls'] }
})
assert.deepEqual(
  edgeFiltered.nodes.map((node) => node.id),
  ['auth:service', 'ui:route']
)

const forbidden = createSubmap(graph, {
  id: 'forbidden',
  selectors: { nodeIds: ['auth:service'] },
  traversal: { direction: 'outgoing', maxDepth: 3 },
  access: { forbidden: { nodeIds: ['auth:repo'] } }
})
assert.deepEqual(
  forbidden.nodes.map((node) => node.id),
  ['auth:repo', 'auth:service']
)
assert.deepEqual(forbidden.access.forbidden, ['auth:repo'])

assert.throws(
  () =>
    createSubmap(graph, {
      id: 'conflict',
      selectors: { nodeIds: ['auth:service'] },
      traversal: { maxDepth: 0 },
      access: {
        editable: { nodeIds: ['auth:service'] },
        forbidden: { nodeIds: ['auth:service'] }
      }
    }),
  (error) => error instanceof SubmapError && error.code === 'SUBMAP_ACCESS_CONFLICT'
)

assert.throws(
  () => createSubmap(graph, { id: 'typo', selectors: { nodeId: ['auth:service'] } }),
  (error) => error instanceof SubmapError && error.code === 'SUBMAP_UNKNOWN_REQUEST_PROPERTY'
)

const recreated = createSubmap(
  { ...graph, generatedAt: '2030-01-01T00:00:00.000Z' },
  {
    id: 'outgoing',
    selectors: { nodeIds: ['auth:service'] },
    traversal: { direction: 'outgoing', maxDepth: 1 },
    access: { editable: { nodeIds: ['auth:service'] } }
  },
  { createdAt: '2030-01-01T00:00:00.000Z' }
)
assert.equal(calculateGraphDigest(graph), calculateGraphDigest({ ...graph, generatedAt: '2030-01-01' }))
assert.equal(outgoing.uid, recreated.uid, 'volatile timestamps must not change the content uid')

const expanded = createSubmap(graph, {
  id: 'outgoing',
  revision: 2,
  parentUid: outgoing.uid,
  selectors: { nodeIds: ['auth:service'] },
  traversal: { direction: 'outgoing', maxDepth: 2 },
  access: { editable: { nodeIds: ['auth:service'] } }
})
const diff = compareSubmaps(outgoing, expanded)
assert.equal(diff.changed, true)
assert.deepEqual(diff.nodes.added, ['shared:db'])

const tampered = structuredClone(outgoing)
tampered.edges[0].to = 'missing'
const tamperedValidation = validateSubmap(tampered)
assert.equal(tamperedValidation.valid, false)
assert.equal(
  tamperedValidation.errors.some((error) => error.code === 'SUBMAP_EDGE_ENDPOINT_MISSING'),
  true
)

const changedGraph = structuredClone(graph)
changedGraph.nodes[0].label = 'Changed'
assert.equal(validateSubmapAgainstGraph(outgoing, changedGraph).valid, false)

const publicApi = await import('@abbaing/code-map/submap')
assert.equal(typeof publicApi.createSubmap, 'function', 'package subpath export must resolve')

console.log('submap unit tests passed')

function fixtureGraph() {
  const nodes = [
    node('ui:route', 'LoginRoute', 'route', 'ui', 'auth', 'src/auth/LoginRoute.tsx'),
    node('auth:service', 'AuthService', 'service', 'application', 'auth', 'src/auth/AuthService.ts'),
    node('auth:repo', 'AuthRepository', 'repository', 'infrastructure', 'auth', 'src/auth/AuthRepository.ts'),
    node('shared:db', 'Database', 'database', 'infrastructure', 'shared', 'src/shared/Database.ts'),
    node('billing:service', 'BillingService', 'service', 'application', 'billing', 'src/billing/BillingService.ts')
  ].sort((a, b) => a.id.localeCompare(b.id))
  const edges = [
    edge('ui:route', 'auth:service', 'calls'),
    edge('auth:service', 'auth:repo', 'imports'),
    edge('auth:repo', 'shared:db', 'queries'),
    edge('shared:db', 'billing:service', 'used-by')
  ].sort((a, b) => a.id.localeCompare(b.id))
  return {
    version: 1,
    generatedAt: '2026-08-05T00:00:00.000Z',
    projectMap: {
      project: { name: 'Fixture' },
      modules: { labels: { auth: 'Authentication' } },
      layers: [{ id: 'application', label: 'Application' }],
      types: { labels: { service: 'Service' } }
    },
    nodes,
    edges,
    findings: [
      {
        id: 'finding:1',
        ruleId: 'architecture.demo',
        severity: 'warning',
        message: 'Demo finding',
        nodeId: 'auth:service'
      }
    ],
    suppressedFindings: [],
    orphans: [nodes.find((item) => item.id === 'billing:service')],
    templates: ['filesystem'],
    architecture: [],
    ruleMetadata: {}
  }
}

function node(id, label, type, layer, module, path) {
  return { id, label, type, layer, module, path, meta: {} }
}

function edge(from, to, type) {
  return { id: `${from}::${type}::${to}`, from, to, type, label: type, confidence: 'high', source: 'fixture' }
}
