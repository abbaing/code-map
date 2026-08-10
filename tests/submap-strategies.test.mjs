import assert from 'node:assert/strict'
import {
  createSubmap,
  defaultAccessStrategy,
  defaultSelectionStrategy,
  defaultTraversalStrategy,
  resolveSubmapStrategies
} from '#submap/index.mjs'

const graph = {
  version: 1,
  generatedAt: '2026-08-09T00:00:00.000Z',
  stats: { nodes: 2, edges: 1 },
  projectMap: { project: { name: 'Strategy Fixture' } },
  nodes: [
    { id: 'a', label: 'A', type: 'service', layer: 'application', module: 'one' },
    { id: 'b', label: 'B', type: 'repository', layer: 'infrastructure', module: 'one' }
  ],
  edges: [{ id: 'a::calls::b', from: 'a', to: 'b', type: 'calls' }]
}
const request = {
  id: 'strategies',
  selectors: { nodeIds: ['a'] },
  traversal: { direction: 'outgoing', maxDepth: 1 },
  access: { editable: { nodeIds: ['a'] } }
}
const createdAt = '2026-08-09T01:00:00.000Z'
const baseline = createSubmap(graph, request, { createdAt })
const calls = []
const strategies = {
  selection: {
    id: 'selection.recording',
    select(input) {
      calls.push('selection')
      return defaultSelectionStrategy.select(input)
    }
  },
  traversal: {
    id: 'traversal.recording',
    traverse(input) {
      calls.push('traversal')
      return defaultTraversalStrategy.traverse(input)
    }
  },
  access: {
    id: 'access.recording',
    resolve(input) {
      calls.push('access')
      return defaultAccessStrategy.resolve(input)
    }
  }
}
const substituted = createSubmap(graph, request, { createdAt, strategies })
assert.deepEqual(substituted, baseline, 'equivalent strategies must preserve the submap contract')
assert.equal(calls.filter((call) => call === 'selection').length, 8)
assert.deepEqual(
  calls.filter((call) => call !== 'selection'),
  ['traversal', 'access']
)
assert.equal(Object.isFrozen(resolveSubmapStrategies()), true)

assert.throws(() => resolveSubmapStrategies(null), /strategies must be an object/u)
assert.throws(() => resolveSubmapStrategies({ selection: {} }), /selection strategy must implement select/u)
assert.throws(
  () =>
    createSubmap(graph, request, {
      createdAt,
      strategies: { selection: { select: () => ['a'] } }
    }),
  /must be a Set of node ids/u
)
assert.throws(
  () =>
    createSubmap(graph, request, {
      createdAt,
      strategies: {
        traversal: {
          traverse: () => ({ eligibleEdges: [], includedIds: new Set(['missing']) })
        }
      }
    }),
  /unknown node ids: missing/u
)
assert.throws(
  () =>
    createSubmap(graph, request, {
      createdAt,
      strategies: {
        traversal: {
          traverse: () => ({ eligibleEdges: [graph.edges[0], graph.edges[0]], includedIds: new Set(['a', 'b']) })
        }
      }
    }),
  /duplicate edges: a::calls::b/u
)
assert.throws(
  () =>
    createSubmap(graph, request, {
      createdAt,
      strategies: {
        traversal: {
          traverse: () => ({
            eligibleEdges: [{ ...graph.edges[0], to: 'a' }],
            includedIds: new Set(['a', 'b'])
          })
        }
      }
    }),
  /changed graph edges: a::calls::b/u
)
assert.throws(
  () =>
    createSubmap(graph, request, {
      createdAt,
      strategies: {
        access: {
          resolve: () => ({
            default: 'readable',
            editable: ['a'],
            readable: [],
            forbidden: [],
            generated: [],
            external: []
          })
        }
      }
    }),
  /assign every included node exactly once/u
)

console.log('submap strategy contract tests passed')
