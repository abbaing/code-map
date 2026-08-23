import assert from 'node:assert/strict'
import { executeDiff } from '#submap/cli-diff.mjs'
import { configureViewerData } from '#viewer/viewer-data.js'
import { gridPlaceDomainCluster } from '#viewer/viewer-layout-domain-grid.js'
import { drillIntoModule, renderModuleDetail, renderOverview, updateViewUI } from '#viewer/viewer-overview.js'
import { exportProjectMap, importProjectMap } from '#viewer/viewer-actions-settings.js'
import { configureViewerElements, state } from '#viewer/viewer-state.js'
import { createCriticalViewerElements } from '#tests/critical-presentation-fixtures.mjs'

const elements = createCriticalViewerElements()
configureViewerElements(elements)

let importedProjectMap
configureViewerData({
  gateway: {
    loadGraph: async () => state.graph,
    scan: async () => ({}),
    updateProjectMap: async (projectMap) => {
      importedProjectMap = projectMap
      return { ok: false, error: 'controlled rejection' }
    },
    listSubmaps: async () => [],
    loadSubmap: async () => ({}),
    deleteSubmap: async () => ({}),
    createSelectionSubmap: async () => ({}),
    createTraceSubmap: async () => ({}),
    reviseSubmap: async () => ({})
  },
  operations: {
    hidePopover() {},
    initializeFindingsFilters() {},
    renderFindings() {},
    renderGraph() {},
    renderModuleDetail() {},
    renderOverview() {}
  }
})

state.graph = {
  projectMap: { project: { name: 'Critical fixture' }, configPath: 'private/project-map.json' },
  nodes: [
    {
      id: 'service',
      label: 'Service',
      module: 'accounts',
      type: 'service',
      layer: 'application',
      meta: { quality: { score: 8 }, coverage: { hasCoverage: true }, findings: [] }
    }
  ],
  edges: [],
  findings: [],
  orphans: []
}
state.filteredNodes = [...state.graph.nodes]
state.selectedTypes = new Set(['service'])
state.selectedHealth = new Set(['excellent', 'very-good', 'good', 'fair', 'low', 'critical'])
state.view = 'overview'
state.activeModule = null
state.selectedId = null

renderOverview()
assert.match(elements.overviewScroll.innerHTML, /accounts/u)
state.activeModule = 'accounts'
renderModuleDetail()
assert.match(elements.moduleDetail.innerHTML, /1 components/u)
state.graph.nodes[0].meta.quality = undefined
state.selectedId = 'service'
renderModuleDetail()
assert.match(elements.moduleDetail.innerHTML, /Service/u)
state.selectedId = null

updateViewUI()
assert.equal(elements.viewTitle.textContent, 'Overview')
drillIntoModule('accounts')
assert.equal(state.view, 'graph')
assert.equal(elements.tabGraph.classList.contains('active'), true)

state.view = 'domain'
const layout = gridPlaceDomainCluster({ nodes: state.graph.nodes }, 180, 20, 30)
assert.deepEqual(layout.positions.get('service'), { x: 0, y: 0 })
assert.equal(layout.width, 180)
assert.equal(layout.height >= 120, true)

const downloads = []
globalThis.window = {
  clearTimeout() {},
  setTimeout(callback) {
    callback()
    return 1
  }
}
globalThis.document = {
  createElement() {
    return {
      click() {
        downloads.push({ href: this.href, download: this.download })
      }
    }
  }
}
globalThis.Blob = class Blob {
  constructor(parts, options) {
    this.parts = parts
    this.options = options
  }
}
globalThis.URL = {
  createObjectURL: () => 'blob:fixture',
  revokeObjectURL() {}
}

exportProjectMap()
assert.equal(downloads.length, 1)
assert.match(downloads[0].download, /^project-map-\d{4}-\d{2}-\d{2}\.json$/u)
assert.equal(elements.settingsExportBtn.disabled, false)

globalThis.FileReader = class FileReader {
  readAsText(file) {
    this.result = file.text
    this.onload()
  }
}
importProjectMap({ text: '{"project":{"name":"Imported"}}' })
await new Promise((resolve) => globalThis.setTimeout(resolve, 0))
assert.equal(importedProjectMap.project.name, 'Imported')
assert.match(elements.toast.textContent, /controlled rejection/u)
assert.equal(elements.settingsImportBtn.classList.contains('disabled'), false)

const output = {
  value: '',
  writeStdout(value) {
    this.value += value
  }
}
const previous = {
  id: 'flow',
  uid: 'before',
  revision: 1,
  nodes: [{ id: 'a' }],
  edges: [],
  findings: [],
  access: { readable: ['a'] }
}
const current = {
  id: 'flow',
  uid: 'after',
  revision: 2,
  nodes: [{ id: 'a' }, { id: 'b' }],
  edges: [{ id: 'a:b' }],
  findings: [],
  access: { editable: ['a'], readable: ['b'] }
}
const repository = { read: (filePath) => (filePath.endsWith('before.json') ? previous : current) }
assert.equal(executeDiff({ positionals: ['before.json', 'after.json'] }, { cwd: '.', repository, output }), 0)
assert.match(output.value, /Nodes: \+1 -0/u)
assert.match(output.value, /Access changes: 2/u)

output.value = ''
assert.equal(
  executeDiff({ positionals: ['before.json', 'after.json'], json: true }, { cwd: '.', repository, output }),
  0
)
assert.equal(JSON.parse(output.value).changed, true)

delete globalThis.FileReader
delete globalThis.URL
delete globalThis.Blob
delete globalThis.document
delete globalThis.window

console.log('critical presentation flow tests passed')
