import assert from 'node:assert/strict'
import fs from 'node:fs'
import { populateSettingsTab } from '#viewer/viewer-actions.js'
import { renderFindingsTable } from '#viewer/viewer-findings.js'
import { nodesForRender, render, renderingStrategies } from '#viewer/viewer-graph.js'
import { layoutNodes, layoutSystemModules } from '#viewer/viewer-layouts.js'
import {
  colors,
  configureViewerElements,
  layerLabels,
  layerOrder,
  moduleLabels,
  state,
  typeLabels
} from '#viewer/viewer-state.js'

const viewerHtml = fs.readFileSync(new URL(import.meta.resolve('#viewer/viewer.html')), 'utf8')
const tailwindCss = fs.readFileSync(new URL(import.meta.resolve('#viewer/tailwind.css')), 'utf8')
const findingsSource = fs.readFileSync(new URL(import.meta.resolve('#viewer/viewer-findings.js')), 'utf8')
const actionsSource = fs.readFileSync(new URL(import.meta.resolve('#viewer/viewer-actions.js')), 'utf8')
const interactionsSource = fs.readFileSync(new URL(import.meta.resolve('#viewer/viewer-interactions.mjs')), 'utf8')
assert.match(
  viewerHtml,
  /<link rel="stylesheet" href="\/tailwind\.css" \/>/u,
  'the viewer must load the compiled local utility stylesheet'
)
assert.match(viewerHtml, /<link rel="icon" href="data:," \/>/u, 'the viewer must suppress implicit favicon requests')
assert.deepEqual(renderingStrategies, {
  layouts: ['system', 'graph', 'domain'],
  nodes: ['system', 'graph', 'domain'],
  edges: ['system', 'graph', 'domain']
})
assert.doesNotMatch(
  viewerHtml,
  /<(?:script|link)\b[^>]*(?:src|href)=["']https?:\/\//iu,
  'the viewer must not load remote scripts or stylesheets'
)
assert.match(viewerHtml, /<script type="module" src="\/viewer-init\.js"><\/script>/u)
assert.match(viewerHtml, /<script type="importmap">/u)
assert.match(viewerHtml, /"#viewer\/": "\/"/u)
assert.equal(
  [...viewerHtml.matchAll(/<script\b/gu)].length,
  2,
  'the viewer must declare one import map and one module entry point'
)
assert.doesNotMatch(
  `${viewerHtml}\n${findingsSource}`,
  /\bonclick\s*=/iu,
  'viewer markup must not contain inline click handlers'
)
assert.match(
  interactionsSource,
  /findingsTable\.addEventListener\('click'/u,
  'finding actions must use event delegation'
)
assert.match(
  tailwindCss,
  /tailwindcss v4\.3\.3/u,
  'the committed utility stylesheet must identify its pinned compiler version'
)
assert.match(
  tailwindCss,
  /\.text-\\\[11px\\\]/u,
  'the compiled stylesheet must include utilities used by dynamic viewer markup'
)

const findingsTable = { innerHTML: '' }
state.graph = { nodes: [] }
configureViewerElements({ findingsTable })
const hostilePath = `src/');globalThis.injected=true;//" onmouseover="alert(1).js`
renderFindingsTable([
  {
    ruleId: 'repo.test',
    severity: 'error',
    message: 'Hostile path regression',
    path: hostilePath
  }
])
assert.doesNotMatch(findingsTable.innerHTML, /onclick=/iu)
assert.doesNotMatch(findingsTable.innerHTML, /navigator\.clipboard/iu)
assert.match(
  findingsTable.innerHTML,
  /data-copy-path="src\/&#39;\);globalThis\.injected=true;\/\/&quot; onmouseover=&quot;alert\(1\)\.js"/u
)

const settingsBody = () => ({
  innerHTML: '',
  querySelectorAll() {
    return []
  }
})
const settingsElements = {
  settingsModulesBody: settingsBody(),
  settingsTypesBody: settingsBody(),
  settingsRulesBody: settingsBody()
}
const hostileId = `users"><img src=x onerror="globalThis.injected=true">`
const hostileLabel = `<script>globalThis.injected=true</script>`
const hostileColor = `#fff"><img src=x onerror="globalThis.injected=true">`
const hostileRule = `rule"><img src=x onerror="globalThis.injected=true">`
state.graph = {
  projectMap: {
    modules: { labels: { [hostileId]: hostileLabel } },
    types: { labels: { [hostileId]: hostileLabel }, colors: { [hostileId]: hostileColor } },
    rules: { enabled: [hostileRule], suppressions: [] }
  }
}
configureViewerElements(settingsElements)
populateSettingsTab()
const settingsMarkup = Object.values(settingsElements)
  .map((body) => body.innerHTML)
  .join('\n')
assert.doesNotMatch(settingsMarkup, /<script|<img|onerror="/iu, 'settings values must not create executable markup')
assert.doesNotMatch(settingsMarkup, /#fff/u, 'invalid configured colors must not reach style attributes')
assert.match(settingsElements.settingsTypesBody.innerHTML, /background:#64748b/u)
assert.match(settingsMarkup, /&lt;script&gt;globalThis\.injected=true&lt;\/script&gt;/u)
assert.doesNotMatch(
  actionsSource,
  /querySelector\(`input\[data-type-hex=/u,
  'configured type ids must not be interpolated into CSS selectors'
)

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

render()
assert.match(svg.innerHTML, /class="node system-module-node"/u, 'graph overview must render module cards')
assert.match(svg.innerHTML, /module-overview-edges/u, 'graph overview must render aggregated module flows')
assert.match(svg.innerHTML, />Users</u)
assert.match(svg.innerHTML, />Shared</u)
assert.equal(classNames.has('hidden'), false, 'the system-map summary must remain visible')
assert.match(banner.textContent, /2 modules/u)
assert.equal(attributes.get('viewBox'), '0 0 1000 720')

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
