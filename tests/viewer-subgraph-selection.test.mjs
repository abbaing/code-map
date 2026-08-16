import assert from 'node:assert/strict'
import { state } from '#viewer/viewer-state.js'
import {
  clearSubgraphSelection,
  replaceSubgraphSelection,
  toggleSubgraphNode
} from '#viewer/viewer-subgraph-selection.js'

Object.assign(state, { view: 'overview', subgraphNodeIds: new Set() })

replaceSubgraphSelection(['node:a', 'node:b', 'node:a'])
assert.deepEqual([...state.subgraphNodeIds], ['node:a', 'node:b'])

toggleSubgraphNode('node:b')
toggleSubgraphNode('node:c')
assert.deepEqual([...state.subgraphNodeIds], ['node:a', 'node:c'])

clearSubgraphSelection()
assert.equal(state.subgraphNodeIds.size, 0)
assert.doesNotThrow(() => clearSubgraphSelection())

console.log('viewer subgraph selection tests passed')
