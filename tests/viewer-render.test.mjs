import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createViewerAssets } from '#delivery/viewer-assets.mjs'
import { populateSettingsTab } from '#viewer/viewer-actions.js'
import { renderFindingsTable } from '#viewer/viewer-findings.js'
import {
  fitLayoutViewport,
  graphEdgesForRender,
  managedEntityCounts,
  renderingStrategies
} from '#viewer/viewer-graph.js'
import { nodeGraphSvg } from '#viewer/viewer-svg.js'
import { configureViewerElements, state } from '#viewer/viewer-state.js'

const viewerHtml = createViewerAssets(fileURLToPath(new URL('../viewer', import.meta.url))).indexHtml
const tailwindCss = fs.readFileSync(new URL(import.meta.resolve('#viewer/tailwind.css')), 'utf8')
const findingsSource = fs.readFileSync(new URL(import.meta.resolve('#viewer/viewer-findings.js')), 'utf8')
const actionsSource = fs.readFileSync(new URL(import.meta.resolve('#viewer/viewer-actions.js')), 'utf8')
const interactionsSource = fs.readFileSync(
  new URL(import.meta.resolve('#viewer/viewer-interaction-filters.mjs')),
  'utf8'
)
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
assert.deepEqual(
  fitLayoutViewport(
    {
      nodes: [{ x: 1800, y: 76, width: 180, height: 52 }],
      moduleLabels: [],
      layerLabels: [{ x: 1800, width: 180 }]
    },
    900,
    700
  ),
  { zoom: 1, panX: 1440, panY: -286 },
  'module navigation must center layouts whose first populated stage is far from the origin'
)
const persistenceEdges = [
  { id: 'context:account', from: 'context', to: 'account', type: 'dbset' },
  { id: 'context:account:usage', from: 'context', to: 'account', type: 'uses-entity' },
  { id: 'context:accounts', from: 'context', to: 'accounts', type: 'queries-table' },
  { id: 'account:accounts', from: 'account', to: 'accounts', type: 'maps-to-table' }
]
const persistenceNodes = new Map([
  ['context', { id: 'context', type: 'data-context' }],
  ['account', { id: 'account', type: 'entity' }],
  ['accounts', { id: 'accounts', type: 'table' }]
])
assert.deepEqual(
  graphEdgesForRender(persistenceEdges, new Set(['context', 'account', 'accounts']), persistenceNodes),
  [persistenceEdges[3]],
  'context catalog relations must not create repeated lines to every entity and table'
)
assert.deepEqual(
  managedEntityCounts(persistenceEdges),
  new Map([['context', 1]]),
  'the context card must retain a summary of its managed entities'
)
assert.match(
  nodeGraphSvg(
    {
      id: 'context',
      label: 'DatabaseContext.cs',
      type: 'data-context',
      module: 'shared',
      layer: 'backend-repository',
      meta: {},
      x: 0,
      y: 0,
      width: 180,
      height: 52
    },
    false,
    false,
    false,
    24
  ),
  /24 entities/u,
  'the context card must display the summarized entity count'
)
assert.doesNotMatch(
  viewerHtml,
  /<(?:script|link)\b[^>]*(?:src|href)=["']https?:\/\//iu,
  'the viewer must not load remote scripts or stylesheets'
)
assert.match(viewerHtml, /<script type="module" src="\/viewer-init\.js"><\/script>/u)
assert.match(viewerHtml, /id="tabSubmaps"/u)
assert.match(viewerHtml, /id="submapsPane"/u)
assert.match(viewerHtml, /id="selectionContextMenu"/u)
assert.doesNotMatch(viewerHtml, /id="submapPreview"/u)
assert.match(viewerHtml, /<details class="interaction-help">/u)
assert.doesNotMatch(viewerHtml, /<details class="interaction-help" open>/u)
assert.match(viewerHtml, /<kbd>Drag<\/kbd> Select an area/u)
assert.match(viewerHtml, /<kbd>Ctrl\/Cmd<\/kbd> \+ click Adjust selection/u)
assert.match(viewerHtml, /<kbd>Alt<\/kbd> \+ drag Pan the graph/u)
assert.match(viewerHtml, /<kbd>Right-click<\/kbd> Selection actions/u)
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

console.log('viewer markup and settings tests passed')
