import assert from 'node:assert/strict'
import { createViewerUiController } from '#viewer/viewer-interactions.mjs'
import { idsInsideRectangle } from '#viewer/viewer-interaction-selection.mjs'
import { createElement, eventTarget, pointerEvent } from '#tests/viewer-interaction-fixture.mjs'

const calls = []
const operationNames = [
  'applyFilters',
  'applyPan',
  'clearSelectedNode',
  'clearSubgraphSelection',
  'createTraceSubmap',
  'createSelectionSubmap',
  'drillIntoModule',
  'exportGraph',
  'exportProjectMap',
  'exportSubgraphSelection',
  'importGraph',
  'importProjectMap',
  'loadGraph',
  'loadSubmaps',
  'openSubmap',
  'populateSettingsTab',
  'refreshGraph',
  'render',
  'renderModuleDetail',
  'renderSubmaps',
  'replaceSubgraphSelection',
  'resetZoom',
  'saveConfig',
  'selectNode',
  'setZoom',
  'showToast',
  'toggleSubgraphNode',
  'updateViewUI',
  'zoomAt'
]
const operations = Object.fromEntries(operationNames.map((name) => [name, (...args) => calls.push([name, ...args])]))
operations.debounce = (operation) => operation

const elements = new Proxy(
  {},
  {
    get(target, property) {
      target[property] ??= createElement()
      return target[property]
    }
  }
)
const documentRef = createElement()
const timers = new Map()
let nextTimerId = 1
const browser = {
  setTimeout(operation) {
    const id = nextTimerId++
    timers.set(id, operation)
    return id
  },
  clearTimeout(id) {
    timers.delete(id)
  }
}
const state = {
  zoom: 1,
  panX: 0,
  panY: 0,
  dragMoved: false,
  suppressOutsideReset: false,
  subgraphNodeIds: new Set(),
  showAllTrace: false,
  view: 'graph',
  activeModule: null,
  selectedHealth: new Set(),
  selectedTypes: new Set(),
  graph: {
    nodes: [{ id: 'node:path', path: 'src/path.ts' }, { id: 'node:logical' }]
  }
}

const controller = createViewerUiController({
  state,
  elements,
  document: documentRef,
  browser,
  clipboard: { async writeText() {} },
  operations
})
assert.equal(controller.bind(), true)
assert.equal(controller.bind(), false, 'interaction binding must be idempotent')

await elements.tabSubmaps.dispatch('click', {})
assert.equal(state.view, 'submaps')
assert.equal(calls.filter(([name]) => name === 'loadSubmaps').length, 1)
state.view = 'graph'

let prevented = false
await elements.canvasWrap.dispatch('wheel', {
  deltaY: 1,
  clientX: 40,
  clientY: 60,
  preventDefault: () => (prevented = true)
})
await elements.canvasWrap.dispatch('wheel', {
  deltaY: -1,
  clientX: 20,
  clientY: 30,
  preventDefault() {}
})
assert.equal(prevented, true)
assert.deepEqual(
  calls.filter(([name]) => name === 'zoomAt'),
  [
    ['zoomAt', 0.88, 40, 60],
    ['zoomAt', 1.12, 20, 30]
  ]
)

const background = eventTarget()
await elements.canvasWrap.dispatch('pointerdown', pointerEvent(background, { button: 1 }))
await elements.canvasWrap.dispatch('pointermove', pointerEvent(background, { button: 1, clientX: 9, clientY: 9 }))
assert.equal(
  calls.some(([name]) => name === 'applyPan'),
  true,
  'the middle pointer must preserve canvas panning'
)
await elements.canvasWrap.dispatch('pointerup', pointerEvent(background, { button: 1 }))
runTimers()
Object.assign(state, { panX: 0, panY: 0 })

await elements.canvasWrap.dispatch(
  'pointerdown',
  pointerEvent(background, { pointerId: 7, clientX: 10, clientY: 20, altKey: true })
)
await elements.canvasWrap.dispatch('pointermove', pointerEvent(background, { clientX: 16, clientY: 10, altKey: true }))
assert.deepEqual([state.panX, state.panY, state.dragMoved], [-6, 10, true])
assert.equal(elements.canvasWrap.classList.contains('dragging'), true)
await elements.canvasWrap.dispatch('pointerup', pointerEvent(background))
assert.equal(state.suppressOutsideReset, true, 'a completed drag must suppress the following background click')
assert.equal(elements.canvasWrap.releasedPointers.has(7), true)
runTimers()
assert.deepEqual([state.dragMoved, state.suppressOutsideReset], [false, false])

elements.selectionBox.parentElement = elements.canvasWrap
await elements.canvasWrap.dispatch('pointerdown', pointerEvent(background, { pointerId: 8, clientX: 20, clientY: 20 }))
await elements.canvasWrap.dispatch('pointerup', pointerEvent(background))
assert.equal(calls.filter(([name]) => name === 'clearSelectedNode').length, 1)
runTimers()

const nodeElements = [
  { dataset: { id: 'inside' }, getBoundingClientRect: () => ({ left: 20, top: 20, width: 20, height: 20 }) },
  { dataset: { id: 'outside' }, getBoundingClientRect: () => ({ left: 80, top: 80, width: 20, height: 20 }) }
]
elements.graph.querySelectorAll = () => nodeElements
await elements.canvasWrap.dispatch('pointerdown', pointerEvent(background, { pointerId: 9, clientX: 10, clientY: 10 }))
await elements.canvasWrap.dispatch('pointermove', pointerEvent(background, { pointerId: 9, clientX: 60, clientY: 60 }))
await elements.canvasWrap.dispatch('pointerup', pointerEvent(background, { pointerId: 9, clientX: 60, clientY: 60 }))
assert.deepEqual(
  calls.find(([name]) => name === 'replaceSubgraphSelection'),
  ['replaceSubgraphSelection', ['inside']]
)
assert.deepEqual(idsInsideRectangle(nodeElements, { left: 0, top: 0, right: 70, bottom: 70 }), ['inside'])
runTimers()

await elements.graph.dispatch('click', { target: eventTarget({ module: 'billing' }) })
assert.deepEqual(
  calls.find(([name]) => name === 'drillIntoModule'),
  ['drillIntoModule', 'billing']
)

await elements.graph.dispatch('click', { target: eventTarget({ id: 'node:logical' }) })
runTimers()
assert.deepEqual(
  calls.find(([name]) => name === 'selectNode'),
  ['selectNode', 'node:logical']
)

await elements.graph.dispatch('click', { target: eventTarget({ id: 'node:logical' }), ctrlKey: true })
assert.deepEqual(
  calls.find(([name]) => name === 'toggleSubgraphNode'),
  ['toggleSubgraphNode', 'node:logical']
)

await elements.graph.dispatch('click', { target: eventTarget({ id: 'node:path' }) })
await elements.graph.dispatch('click', { target: eventTarget({ id: 'node:path' }) })
assert.equal(elements.findingsSearch.value, 'src/path.ts')
assert.equal(state.view, 'findings')
assert.equal(calls.filter(([name]) => name === 'updateViewUI').length, 2)
assert.equal(calls.filter(([name]) => name === 'applyFilters').length, 1)

console.log('viewer interaction behavior tests passed')

function runTimers() {
  const pending = [...timers.values()]
  timers.clear()
  pending.forEach((operation) => operation())
}
