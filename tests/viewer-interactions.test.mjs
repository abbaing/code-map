import assert from 'node:assert/strict'
import { createViewerUiController } from '#viewer/viewer-interactions.mjs'

const calls = []
const operationNames = [
  'applyFilters',
  'applyPan',
  'clearSelectedNode',
  'createTraceSubmap',
  'drillIntoModule',
  'exportGraph',
  'exportProjectMap',
  'importGraph',
  'importProjectMap',
  'loadGraph',
  'populateSettingsTab',
  'refreshGraph',
  'render',
  'renderModuleDetail',
  'resetZoom',
  'saveConfig',
  'selectNode',
  'setZoom',
  'showToast',
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
await elements.canvasWrap.dispatch('pointermove', pointerEvent(background, { clientX: 9, clientY: 9 }))
assert.equal(
  calls.some(([name]) => name === 'applyPan'),
  false,
  'non-primary pointers must not start a drag'
)

await elements.canvasWrap.dispatch('pointerdown', pointerEvent(background, { pointerId: 7, clientX: 10, clientY: 20 }))
await elements.canvasWrap.dispatch('pointermove', pointerEvent(background, { clientX: 16, clientY: 10 }))
assert.deepEqual([state.panX, state.panY, state.dragMoved], [-6, 10, true])
assert.equal(elements.canvasWrap.classList.contains('dragging'), true)
await elements.canvasWrap.dispatch('pointerup', pointerEvent(background))
assert.equal(state.suppressOutsideReset, true, 'a completed drag must suppress the following background click')
assert.equal(elements.canvasWrap.releasedPointers.has(7), true)
runTimers()
assert.deepEqual([state.dragMoved, state.suppressOutsideReset], [false, false])

await elements.canvasWrap.dispatch('pointerdown', pointerEvent(background, { pointerId: 8, clientX: 20, clientY: 20 }))
await elements.canvasWrap.dispatch('pointerup', pointerEvent(background))
assert.equal(calls.filter(([name]) => name === 'clearSelectedNode').length, 1)
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

await elements.graph.dispatch('click', { target: eventTarget({ id: 'node:path' }) })
await elements.graph.dispatch('click', { target: eventTarget({ id: 'node:path' }) })
assert.equal(elements.findingsSearch.value, 'src/path.ts')
assert.equal(state.view, 'findings')
assert.equal(calls.filter(([name]) => name === 'updateViewUI').length, 1)
assert.equal(calls.filter(([name]) => name === 'applyFilters').length, 1)

console.log('viewer interaction behavior tests passed')

function createElement() {
  const listeners = new Map()
  const classes = new Set()
  const capturedPointers = new Set()
  return {
    value: '',
    listeners,
    releasedPointers: new Set(),
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      toggle(name, force) {
        const enabled = force ?? !classes.has(name)
        if (enabled) {
          classes.add(name)
        } else {
          classes.delete(name)
        }
        return enabled
      },
      contains: (name) => classes.has(name)
    },
    addEventListener(type, listener) {
      const entries = listeners.get(type) ?? []
      entries.push(listener)
      listeners.set(type, entries)
    },
    async dispatch(type, event) {
      for (const listener of listeners.get(type) ?? []) {
        await listener(event)
      }
    },
    contains() {
      return false
    },
    setPointerCapture(id) {
      capturedPointers.add(id)
    },
    hasPointerCapture(id) {
      return capturedPointers.has(id)
    },
    releasePointerCapture(id) {
      capturedPointers.delete(id)
      this.releasedPointers.add(id)
    }
  }
}

function eventTarget({ id, module } = {}) {
  const node = id || module ? { dataset: { id, module } } : null
  return {
    closest(selector) {
      return selector === '.node' ? node : null
    }
  }
}

function pointerEvent(target, overrides = {}) {
  return {
    button: 0,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    target,
    preventDefault() {},
    ...overrides
  }
}

function runTimers() {
  const pending = [...timers.values()]
  timers.clear()
  pending.forEach((operation) => operation())
}
