import assert from 'node:assert/strict'
import { buttonBusy, buttonIdle, showToast } from '#viewer/viewer-feedback.js'
import { healthDescription, healthPill, scoreToHealthKey } from '#viewer/viewer-health.js'
import { configureViewerElements, resolveViewerElements, state } from '#viewer/viewer-state.js'
import { applyPan, resetZoom, setZoom, zoomAt } from '#viewer/viewer-viewport.js'

assert.equal(scoreToHealthKey(9.5), 'excellent')
assert.equal(scoreToHealthKey(4), 'critical')
assert.equal(healthPill(8.5).label, 'Very good')
assert.equal(healthPill(0).label, 'N/A')
assert.equal(healthDescription('unknown'), healthDescription('n/a'))

const requestedIds = []
const resolved = resolveViewerElements({
  getElementById(id) {
    requestedIds.push(id)
    return { id }
  }
})
assert.equal(resolved.projectName.id, 'projectName')
assert.ok(requestedIds.includes('settingsImportFile'))

const button = { disabled: false, innerHTML: 'Save' }
buttonBusy(button)
assert.equal(button.disabled, true)
assert.match(button.innerHTML, /btn-spin/u)
buttonIdle(button)
assert.deepEqual(button, { disabled: false, innerHTML: 'Save', _savedHTML: 'Save' })

const classes = new Set()
const graph = {
  parentElement: { clientWidth: 800, clientHeight: 600 },
  setAttribute(name, value) {
    this[name] = value
  },
  getBoundingClientRect() {
    return { left: 10, top: 20 }
  }
}
configureViewerElements({
  graph,
  zoomValue: { textContent: '' },
  toast: {
    classList: {
      add(name) {
        classes.add(name)
      },
      remove(name) {
        classes.delete(name)
      },
      toggle(name, active) {
        if (active) {
          classes.add(name)
        } else {
          classes.delete(name)
        }
      }
    },
    textContent: ''
  }
})
globalThis.window = {
  clearTimeout() {},
  setTimeout(callback) {
    callback()
    return 1
  }
}
Object.assign(state, { zoom: 1, panX: 0, panY: 0 })
applyPan()
assert.equal(graph.viewBox, '0 0 800 600')
setZoom(4)
assert.equal(state.zoom, 2.5)
zoomAt(2, 110, 120)
assert.equal(graph.viewBox, '-10 -10 400 300')
resetZoom()
assert.equal(graph.viewBox, '0 0 800 600')
showToast('Failed', 'error')
assert.equal(classes.has('error'), true)
assert.equal(classes.has('open'), false)

delete globalThis.window
console.log('viewer presentation tests passed')
