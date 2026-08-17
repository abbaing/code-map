import assert from 'node:assert/strict'
import { createElement } from '#tests/viewer-interaction-fixture.mjs'
import { configureViewerElements, state } from '#viewer/viewer-state.js'
import {
  clearSubgraphSelection,
  discardSubmapChanges,
  replaceSubgraphSelection,
  toggleSubgraphNode
} from '#viewer/viewer-subgraph-selection.js'

const selectionBar = createElement()
const elements = {
  selectionBar,
  selectionCount: createElement(),
  selectionState: createElement(),
  selectionNameInput: createElement(),
  selectionCreateBtn: createElement(),
  selectionSaveBtn: createElement(),
  selectionDiscardBtn: createElement()
}
configureViewerElements(elements)
Object.assign(state, { view: 'overview', subgraphNodeIds: new Set(), activeSubmap: null })

replaceSubgraphSelection(['node:a', 'node:b', 'node:a'])
assert.deepEqual([...state.subgraphNodeIds], ['node:a', 'node:b'])
assert.equal(elements.selectionCount.textContent, '2 nodes selected')
assert.equal(selectionBar.classList.contains('hidden'), false)

toggleSubgraphNode('node:b')
toggleSubgraphNode('node:c')
assert.deepEqual([...state.subgraphNodeIds], ['node:a', 'node:c'])

clearSubgraphSelection()
assert.equal(state.subgraphNodeIds.size, 0)
assert.equal(selectionBar.classList.contains('hidden'), true)
assert.doesNotThrow(() => clearSubgraphSelection())

state.activeSubmap = { revision: 2, nodeIds: new Set(['node:a']) }
replaceSubgraphSelection(['node:a'])
assert.equal(elements.selectionState.textContent, 'Saved r2')
toggleSubgraphNode('node:b')
assert.equal(elements.selectionState.textContent, 'Unsaved changes')
assert.equal(elements.selectionSaveBtn.disabled, false)
discardSubmapChanges()
assert.deepEqual([...state.subgraphNodeIds], ['node:a'])
assert.equal(elements.selectionSaveBtn.disabled, true)

console.log('viewer subgraph selection tests passed')
