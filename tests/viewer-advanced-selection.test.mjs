import assert from 'node:assert/strict'
import { createElement } from '#tests/viewer-interaction-fixture.mjs'
import { combineRectangleSelection } from '#viewer/viewer-interaction-selection.mjs'
import { bindViewerShortcuts } from '#viewer/viewer-interaction-shortcuts.mjs'

assert.deepEqual(combineRectangleSelection(new Set(['a']), ['b'], 'replace'), ['b'])
assert.deepEqual(combineRectangleSelection(new Set(['a']), ['b'], 'add'), ['a', 'b'])
assert.deepEqual(combineRectangleSelection(new Set(['a', 'b']), ['b', 'c'], 'toggle'), ['a', 'c'])

const document = createElement()
let openSubmapMenus = []
const elements = {
  selectionContextMenu: createElement(),
  submapList: { querySelectorAll: () => openSubmapMenus }
}
const calls = []
const operation = (name) => () => calls.push(name)
const state = {
  view: 'graph',
  activeSubmap: null,
  subgraphNodeIds: new Set(['node:a'])
}
bindViewerShortcuts({
  document,
  elements,
  state,
  operations: {
    selectVisibleSubgraphNodes: operation('select-all'),
    invertVisibleSubgraphSelection: operation('invert'),
    createSelectionSubmap: operation('create'),
    saveSubmapRevision: operation('save'),
    clearSubgraphSelection: operation('clear')
  }
})

await document.dispatch('keydown', shortcut('a'))
await document.dispatch('keydown', shortcut('a', { shiftKey: true }))
await document.dispatch('keydown', shortcut('Enter'))
state.activeSubmap = { uid: 'revision' }
await document.dispatch('keydown', shortcut('s'))
assert.deepEqual(calls, ['select-all', 'invert', 'create', 'save'])

const editable = { closest: () => ({ tagName: 'INPUT' }) }
await document.dispatch('keydown', shortcut('a', { target: editable }))
assert.equal(calls.length, 4, 'text editing shortcuts must remain native')

let menuClosed = false
openSubmapMenus = [{ removeAttribute: () => (menuClosed = true) }]
await document.dispatch('keydown', shortcut('Escape', { ctrlKey: false }))
assert.equal(menuClosed, true)
openSubmapMenus = []
await document.dispatch('keydown', shortcut('Escape', { ctrlKey: false }))
assert.equal(elements.selectionContextMenu.classList.contains('hidden'), true)
state.activeSubmap = null
await document.dispatch('keydown', shortcut('Escape', { ctrlKey: false }))
assert.equal(calls.at(-1), 'clear')

console.log('viewer advanced selection tests passed')

function shortcut(key, overrides = {}) {
  return {
    key,
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    target: createElement(),
    preventDefault() {},
    ...overrides
  }
}
