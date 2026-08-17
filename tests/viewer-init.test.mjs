import assert from 'node:assert/strict'
import { startViewer } from '#viewer/viewer-init.js'

const gateway = Object.freeze({
  loadGraph() {},
  scan() {},
  updateProjectMap() {},
  listSubmaps() {},
  loadSubmap() {},
  createSelectionSubmap() {},
  createTraceSubmap() {},
  reviseSubmap() {}
})
const documentRef = { addEventListener() {} }
const browser = { setTimeout, clearTimeout }
const passiveElement = { classList: { add() {}, remove() {}, toggle() {} } }
const elements = new Proxy(
  { status: { textContent: '' }, viewTitle: { textContent: '' }, viewSubtitle: { textContent: '' } },
  { get: (target, property) => target[property] ?? passiveElement }
)
const clipboardWrites = []
let controllerDependencies

await startViewer({
  gateway,
  document: documentRef,
  browser,
  navigator: { clipboard: { writeText: async (value) => clipboardWrites.push(value) } },
  elements,
  controllerFactory(dependencies) {
    controllerDependencies = dependencies
    return { start: async () => 'started' }
  }
})

assert.equal(controllerDependencies.document, documentRef)
assert.equal(controllerDependencies.browser, browser)
assert.equal(controllerDependencies.elements, elements)
assert.equal(controllerDependencies.state.view, 'overview')
for (const operation of ['loadGraph', 'render', 'saveConfig', 'zoomAt']) {
  assert.equal(typeof controllerDependencies.operations[operation], 'function')
}
controllerDependencies.operations.updateViewUI()
assert.equal(elements.viewTitle.textContent, 'Overview')
assert.equal(elements.viewSubtitle.textContent, 'Repository health and module inventory')
await controllerDependencies.clipboard.writeText('graph JSON')
assert.deepEqual(clipboardWrites, ['graph JSON'])

let unavailableClipboard
await startViewer({
  gateway,
  document: documentRef,
  browser,
  navigator: {},
  elements,
  controllerFactory(dependencies) {
    unavailableClipboard = dependencies.clipboard
    return { start: async () => undefined }
  }
})
await assert.rejects(() => unavailableClipboard.writeText('graph JSON'), /Clipboard access is unavailable/u)

await startViewer({
  gateway,
  document: documentRef,
  browser,
  elements,
  controllerFactory() {
    return { start: async () => Promise.reject(new Error('controlled startup failure')) }
  }
})
assert.equal(elements.status.textContent, 'Error: controlled startup failure')

console.log('viewer initialization tests passed')
