import assert from 'node:assert/strict'
import { GraphGatewayError, assertGraphGateway, createGraphGateway } from '#viewer/graph-gateway.mjs'
import { assertTraceStrategy, createTraceStrategy } from '#viewer/trace-strategy.mjs'
import { configureViewerData } from '#viewer/viewer-data.js'
import { assertViewerStore, createViewerStore } from '#viewer/viewer-store.mjs'

const store = createViewerStore({ selectedId: null, selectedTypes: new Set(['page']) })
assertViewerStore(store)
const liveState = store.state
const changes = []
const unsubscribe = store.subscribe((state) => changes.push(state))
const initial = store.getState()
initial.selectedTypes.add('handler')
assert.deepEqual([...store.getState().selectedTypes], ['page'], 'readers must not mutate stored state')
store.update({ selectedId: 'users' })
assert.equal(store.state, liveState, 'updates must preserve the state reference used by viewer modules')
store.update((state) => ({ selectedId: `${state.selectedId}-page` }))
unsubscribe()
store.update({ selectedId: 'ignored' })
assert.deepEqual(
  changes.map((state) => state.selectedId),
  ['users', 'users-page'],
  'subscribers must receive updates until they unsubscribe'
)
assert.throws(() => store.subscribe(null), /listener must be a function/u)
assert.throws(() => assertViewerStore(null), { message: 'ViewerStore must be an object' })
assert.throws(() => assertViewerStore({ getState() {} }), /update/u)

const requests = []
const gateway = createGraphGateway({
  request: async (resource, options) => {
    requests.push({ resource, options })
    return {
      ok: true,
      async json() {
        return { resource }
      }
    }
  }
})
assertGraphGateway(gateway)
assert.throws(() => assertGraphGateway(null), { message: 'GraphGateway must be an object' })
await gateway.loadGraph()
await gateway.scan()
await gateway.updateProjectMap({ modules: {} })
await gateway.createTraceSubmap({ selectedId: 'users' })
await gateway.listSubmaps()
await gateway.loadSubmap('sha256:abc')
await gateway.createSelectionSubmap({ name: 'checkout', nodeIds: ['users'] })
assert.deepEqual(
  requests.map(({ resource }) => resource),
  [
    '/graph.json',
    '/api/scan',
    '/api/project-map',
    '/api/submaps/from-trace',
    '/api/submaps',
    '/api/submaps/sha256%3Aabc',
    '/api/submaps/from-selection'
  ]
)
assert.equal(requests[2].options.method, 'POST')
assert.equal(requests[3].options.method, 'POST')
assert.throws(() => createGraphGateway({ request: null }), /request must be a function/u)
assert.throws(() => configureViewerData({ gateway, operations: {} }), /hidePopover/u)
const failingGateway = createGraphGateway({
  request: async () => ({
    ok: false,
    status: 409,
    async json() {
      return { error: 'conflict' }
    }
  })
})
await assert.rejects(
  () => failingGateway.scan(),
  (error) => {
    assert.equal(error instanceof GraphGatewayError, true)
    assert.equal(error.status, 409)
    assert.equal(error.message, 'conflict')
    return true
  }
)

const strategyFactories = [
  () => ({
    buildTrace: (graph, selectedId) => ({ graph, selectedId }),
    buildModuleTrace: (graph, module) => ({ graph, module }),
    buildSystemGraph: (graph, nodes) => ({ graph, nodes })
  }),
  () => ({
    buildTrace: (_graph, selectedId) => ({ selectedId }),
    buildModuleTrace: (_graph, module) => ({ module }),
    buildSystemGraph: (_graph, nodes) => ({ nodes })
  })
]
for (const factory of strategyFactories) {
  const strategy = createTraceStrategy(factory())
  assertTraceStrategy(strategy)
  assert.equal(strategy.buildTrace({}, 'users').selectedId, 'users')
  assert.equal(strategy.buildModuleTrace({}, 'billing').module, 'billing')
  assert.deepEqual(strategy.buildSystemGraph({}, ['node']).nodes, ['node'])
}
assert.throws(() => createTraceStrategy({ buildTrace() {} }), /buildModuleTrace/u)

console.log('viewer contract tests passed')
