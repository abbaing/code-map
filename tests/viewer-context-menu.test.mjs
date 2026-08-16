import assert from 'node:assert/strict'
import { bindSelectionContextMenu } from '#viewer/viewer-interaction-context-menu.mjs'
import { createElement, eventTarget } from '#tests/viewer-interaction-fixture.mjs'

const canvasWrap = createElement({ bounds: { left: 10, top: 20, width: 500, height: 400 } })
const menu = createElement()
Object.assign(menu, { offsetWidth: 200, offsetHeight: 150 })
const elements = {
  canvasWrap,
  selectionContextMenu: menu,
  selectionContextCreateBtn: createElement(),
  selectionContextExportBtn: createElement(),
  selectionContextRemoveBtn: createElement(),
  selectionContextClearBtn: createElement()
}
const calls = []
const operations = {
  async createSelectionSubmap() {
    calls.push(['create'])
  },
  exportSubgraphSelection() {
    calls.push(['export'])
  },
  toggleSubgraphNode(id) {
    calls.push(['remove', id])
  },
  clearSubgraphSelection() {
    calls.push(['clear'])
  }
}
bindSelectionContextMenu({
  elements,
  state: { subgraphNodeIds: new Set(['node:a', 'node:b']) },
  operations
})

let prevented = false
await canvasWrap.dispatch('contextmenu', {
  target: eventTarget({ id: 'node:a' }),
  clientX: 490,
  clientY: 390,
  preventDefault: () => (prevented = true)
})
assert.equal(prevented, true)
assert.equal(menu.classList.contains('hidden'), false)
assert.deepEqual(menu.style, { left: '292px', top: '242px' })
assert.equal(elements.selectionContextRemoveBtn.classList.contains('hidden'), false)
await elements.selectionContextRemoveBtn.dispatch('click', {})
assert.deepEqual(calls.pop(), ['remove', 'node:a'])

await canvasWrap.dispatch('contextmenu', {
  target: eventTarget(),
  clientX: 80,
  clientY: 90,
  preventDefault() {}
})
assert.equal(elements.selectionContextRemoveBtn.classList.contains('hidden'), true)
await elements.selectionContextExportBtn.dispatch('click', {})
assert.deepEqual(calls.pop(), ['export'])

await canvasWrap.dispatch('contextmenu', {
  target: eventTarget({ id: 'node:outside' }),
  clientX: 40,
  clientY: 40,
  preventDefault: () => assert.fail('an unselected node must keep its native context menu')
})

console.log('viewer selection context menu tests passed')
