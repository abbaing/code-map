import assert from 'node:assert/strict'
import { render, nodesForRender } from '#viewer/viewer-graph.js'
import { layoutNodes, layoutSystemModules } from '#viewer/viewer-layouts.js'
import { edgeLine } from '#viewer/viewer-selection.js'
import {
  colors,
  configureViewerElements,
  layerLabels,
  layerOrder,
  moduleLabels,
  state,
  typeLabels
} from '#viewer/viewer-state.js'

const classNames = new Set(['hidden'])
const attributes = new Map()
const svg = {
  parentElement: { clientWidth: 1000, clientHeight: 720 },
  style: {},
  innerHTML: '',
  setAttribute(name, value) {
    attributes.set(name, value)
  }
}
const graphData = {
  nodes: [
    {
      id: 'front',
      label: 'UsersPage',
      type: 'page',
      layer: 'ui-page',
      module: 'users',
      path: 'front/UsersPage.tsx',
      meta: {}
    },
    {
      id: 'back',
      label: 'UsersHandler',
      type: 'handler',
      layer: 'application-handler',
      module: 'users',
      path: 'back/UsersHandler.cs',
      meta: {}
    },
    {
      id: 'support',
      label: 'UsersSupport',
      type: 'service',
      layer: 'backend-service',
      module: 'users',
      path: 'back/UsersSupport.cs',
      meta: {}
    },
    {
      id: 'shared',
      label: 'Database',
      type: 'table',
      layer: 'database',
      module: 'shared',
      path: 'back/Database.cs',
      meta: {}
    }
  ],
  edges: [
    { id: 'front:back', from: 'front', to: 'back', type: 'calls-api', confidence: 'high' },
    { id: 'back:shared', from: 'back', to: 'shared', type: 'queries-table', confidence: 'high' }
  ],
  findings: [],
  orphans: []
}
const banner = {
  textContent: '',
  classList: {
    add(name) {
      classNames.add(name)
    },
    remove(name) {
      classNames.delete(name)
    }
  }
}
Object.assign(state, {
  graph: graphData,
  filteredNodes: graphData.nodes,
  selectedId: null,
  showAllTrace: false,
  trace: null,
  zoom: 1,
  panX: 0,
  panY: 0,
  view: 'graph',
  activeModule: null
})
configureViewerElements({ graph: svg, nodeLimitBanner: banner, zoomValue: { textContent: '' } })
Object.assign(moduleLabels, { users: 'Users', shared: 'Shared' })
Object.assign(layerLabels, {})
Object.assign(typeLabels, {})
Object.assign(colors, {})
layerOrder.splice(0)
state.selectedId = 'front'
const provenanceMarkup = edgeLine({
  from: 'front',
  to: 'back',
  label: 'calls API',
  confidence: 'medium',
  source: 'endpoint-matcher',
  evidence: 'GET /api/users'
})
assert.match(provenanceMarkup, /medium confidence · endpoint-matcher · GET \/api\/users/u)
state.selectedId = null
render()
assert.match(svg.innerHTML, /class="node system-module-node"/u, 'graph overview must render module cards')
assert.match(svg.innerHTML, /module-overview-edges/u, 'graph overview must render aggregated module flows')
assert.match(svg.innerHTML, />Users</u)
assert.match(svg.innerHTML, />Shared</u)
assert.equal(classNames.has('hidden'), false, 'the system-map summary must remain visible')
assert.match(banner.textContent, /2 modules/u)
assert.equal(attributes.get('viewBox'), '0 0 1000 720')

state.activeModule = 'users'
render()
const modulePositions = nodePositions(svg.innerHTML)
state.selectedId = 'back'
render()
assert.deepEqual(
  nodePositions(svg.innerHTML),
  modulePositions,
  'selecting a component must preserve the module graph layout'
)
assert.match(svg.innerHTML, /class="node selected[^"]*" data-id="back"/u, 'selected component must remain highlighted')
state.selectedId = null
state.activeModule = null

const layout = layoutSystemModules(
  [
    { id: 'z', label: 'Z', module: 'z', meta: { externalRelations: 1 } },
    { id: 'shared', label: 'Shared', module: 'shared', meta: { externalRelations: 0 } }
  ],
  900,
  700
)
assert.equal(layout.nodes[0].module, 'shared', 'shared must be placed first in the system map')
assert.equal(
  layout.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)),
  true
)

const traceNodes = nodesForRender(state.graph.nodes.slice(0, 1), 1, {
  nodeIds: new Set(['front', 'shared'])
})
assert.deepEqual(
  traceNodes.map((node) => node.id),
  ['front', 'shared'],
  'trace nodes must survive the normal render limit'
)

const domainNodes = [
  { id: 'user', label: 'User', type: 'entity', module: 'users', meta: { domain: { properties: [] } } },
  { id: 'role', label: 'Role', type: 'entity', module: 'users', meta: { domain: { properties: [] } } }
]
Object.assign(state, {
  view: 'domain',
  graph: {
    nodes: domainNodes,
    edges: [{ id: 'user:role', from: 'user', to: 'role', type: 'domain-relation' }],
    projectMap: { modules: { shared: 'shared' } }
  }
})
const firstDomainLayout = layoutNodes(domainNodes, 900, 700)
const secondDomainLayout = layoutNodes(domainNodes, 900, 700)
assert.deepEqual(
  firstDomainLayout.nodes.map(({ id, x, y }) => ({ id, x, y })),
  secondDomainLayout.nodes.map(({ id, x, y }) => ({ id, x, y })),
  'domain simulation must remain deterministic after extraction'
)
assert.equal(
  firstDomainLayout.nodes.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)),
  true
)

console.log('viewer render tests passed')

console.log('viewer graph rendering tests passed')

function nodePositions(markup) {
  return new Map(
    [...markup.matchAll(/data-id="([^"]+)" transform="translate\(([^)]+)\)"/gu)].map((match) => [match[1], match[2]])
  )
}
