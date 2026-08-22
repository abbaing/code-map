import assert from 'node:assert/strict'
import { render } from '#viewer/viewer-graph.js'
import { configureViewerElements, state } from '#viewer/viewer-state.js'

const attributes = new Map()
const graph = {
  nodes: [
    { id: 'focused-a', label: 'Focused A', type: 'page', layer: 'ui-page', module: 'checkout', meta: {} },
    { id: 'focused-b', label: 'Focused B', type: 'handler', layer: 'application', module: 'checkout', meta: {} },
    { id: 'unrelated', label: 'Unrelated', type: 'service', layer: 'backend', module: 'orders', meta: {} }
  ],
  edges: [{ id: 'a:b', from: 'focused-a', to: 'focused-b', type: 'calls-api', confidence: 'high' }],
  findings: [],
  orphans: []
}
const svg = {
  parentElement: { clientWidth: 1000, clientHeight: 720 },
  style: {},
  innerHTML: '',
  setAttribute(name, value) {
    attributes.set(name, value)
  }
}
const banner = {
  classList: { add() {}, remove() {} },
  textContent: ''
}

configureViewerElements({ graph: svg, nodeLimitBanner: banner, zoomValue: { textContent: '' } })
Object.assign(state, {
  graph,
  view: 'graph',
  activeSubmap: { id: 'focused', nodeIds: new Set(['focused-a', 'focused-b']) },
  activeModule: null,
  selectedId: null,
  trace: null,
  filteredNodes: graph.nodes.slice(0, 2),
  subgraphNodeIds: new Set(['focused-a', 'focused-b']),
  zoom: 2,
  panX: 999,
  panY: -500,
  fitView: true
})

render()

assert.doesNotMatch(svg.innerHTML, /system-module-node/u, 'an active submap must bypass the system overview')
assert.match(svg.innerHTML, /data-id="focused-a"/u)
assert.match(svg.innerHTML, /data-id="focused-b"/u)
assert.doesNotMatch(svg.innerHTML, /data-id="unrelated"/u)
assert.equal(state.fitView, false)
assert.equal(state.zoom <= 1, true)
assert.notEqual(attributes.get('viewBox'), '999 -500 500 360')

console.log('viewer submap focus tests passed')
