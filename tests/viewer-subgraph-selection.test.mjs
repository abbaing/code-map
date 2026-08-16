import assert from 'node:assert/strict'
import { createElement } from '#tests/viewer-interaction-fixture.mjs'
import { configureViewerElements, state } from '#viewer/viewer-state.js'
import {
  clearSubgraphSelection,
  replaceSubgraphSelection,
  toggleSubgraphNode
} from '#viewer/viewer-subgraph-selection.js'

const selectionBar = createElement()
const selectionCount = { textContent: '' }
configureViewerElements({ selectionBar, selectionCount })
Object.assign(state, { view: 'overview', subgraphNodeIds: new Set() })

replaceSubgraphSelection(['node:a', 'node:b', 'node:a'])
assert.deepEqual([...state.subgraphNodeIds], ['node:a', 'node:b'])
assert.equal(selectionCount.textContent, '2 nodes selected')
assert.equal(selectionBar.classList.contains('hidden'), false)

toggleSubgraphNode('node:b')
toggleSubgraphNode('node:c')
assert.deepEqual([...state.subgraphNodeIds], ['node:a', 'node:c'])

clearSubgraphSelection()
assert.equal(state.subgraphNodeIds.size, 0)
assert.equal(selectionBar.classList.contains('hidden'), true)
assert.doesNotThrow(() => clearSubgraphSelection())

console.log('viewer subgraph selection tests passed')
