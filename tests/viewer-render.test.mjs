import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const viewerHtml = fs.readFileSync(new URL('../viewer/viewer.html', import.meta.url), 'utf8')
const tailwindCss = fs.readFileSync(new URL('../viewer/tailwind.css', import.meta.url), 'utf8')
const findingsSource = fs.readFileSync(new URL('../viewer/viewer-findings.js', import.meta.url), 'utf8')
const interactionsSource = fs.readFileSync(new URL('../viewer/viewer-interactions.mjs', import.meta.url), 'utf8')
assert.match(
  viewerHtml,
  /<link rel="stylesheet" href="\/tailwind\.css" \/>/u,
  'the viewer must load the compiled local utility stylesheet'
)
assert.doesNotMatch(
  viewerHtml,
  /<(?:script|link)\b[^>]*(?:src|href)=["']https?:\/\//iu,
  'the viewer must not load remote scripts or stylesheets'
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
const findingsContext = vm.createContext({
  state: { graph: { nodes: [] } },
  els: { findingsTable },
  moduleLabels: {},
  layerLabels: {},
  typeLabels: {},
  console
})
for (const source of [fs.readFileSync(new URL('../viewer/viewer-utils.js', import.meta.url), 'utf8'), findingsSource]) {
  vm.runInContext(source, findingsContext)
}
vm.runInContext('globalThis.findingsApi = { renderFindingsTable }', findingsContext)
const hostilePath = `src/');globalThis.injected=true;//" onmouseover="alert(1).js`
findingsContext.findingsApi.renderFindingsTable([
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
const context = vm.createContext({
  state: {
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
  },
  els: {
    graph: svg,
    nodeLimitBanner: banner,
    zoomValue: { textContent: '' }
  },
  moduleLabels: { users: 'Users', shared: 'Shared' },
  layerLabels: {},
  typeLabels: {},
  colors: {},
  layerOrder: [],
  console
})

for (const file of ['viewer-utils.js', 'viewer-trace.js', 'viewer-graph.js']) {
  vm.runInContext(fs.readFileSync(new URL(`../viewer/${file}`, import.meta.url), 'utf8'), context, { filename: file })
}
vm.runInContext('globalThis.viewerApi = { render, layoutSystemModules, nodesForRender }', context)

context.viewerApi.render()
assert.match(svg.innerHTML, /class="node system-module-node"/u, 'graph overview must render module cards')
assert.match(svg.innerHTML, /module-overview-edges/u, 'graph overview must render aggregated module flows')
assert.match(svg.innerHTML, />Users</u)
assert.match(svg.innerHTML, />Shared</u)
assert.equal(classNames.has('hidden'), false, 'the system-map summary must remain visible')
assert.match(banner.textContent, /2 modules/u)
assert.equal(attributes.get('viewBox'), '0 0 1000 720')

const layout = context.viewerApi.layoutSystemModules(
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

const traceNodes = context.viewerApi.nodesForRender(context.state.graph.nodes.slice(0, 1), 1, {
  nodeIds: new Set(['front', 'shared'])
})
assert.deepEqual(
  traceNodes.map((node) => node.id),
  ['front', 'shared'],
  'trace nodes must survive the normal render limit'
)

console.log('viewer render tests passed')
