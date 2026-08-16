import assert from 'node:assert/strict'
import { edgeSvg, systemModuleEdgeSvg } from '#viewer/viewer-svg.js'
import { state } from '#viewer/viewer-state.js'

const left = { id: 'left', x: 10, y: 20, width: 100, height: 40 }
const right = { id: 'right', x: 300, y: 100, width: 120, height: 60 }
const nodeById = new Map([
  [left.id, left],
  [right.id, right]
])

state.view = 'graph'
const forward = edgeSvg(
  { from: 'left', to: 'right', type: 'calls-api', confidence: 'high' },
  nodeById,
  true,
  true,
  true
)
assert.match(forward, /class="edge edge-type-calls-api confidence-high highlight focused dimmed"/u)
assert.match(forward, /d="M 110 40 C 205 40, 205 130, 300 130"/u)

const reverse = edgeSvg({ from: 'right', to: 'left', type: 'returns', confidence: undefined }, nodeById, false)
assert.match(reverse, /confidence-medium/u)
assert.match(
  reverse,
  /d="M 300 130 C 205 130, 205 40, 110 40"/u,
  'an edge arrow must point from its semantic source to its semantic target'
)

assert.equal(edgeSvg({ from: 'missing', to: 'right', type: 'imports' }, nodeById, false), '')
assert.equal(edgeSvg({ from: 'left', to: 'missing', type: 'imports' }, nodeById, false), '')

const hostileClasses = edgeSvg(
  { from: 'left', to: 'right', type: `calls"><script>attack</script>`, confidence: `high" onload="attack` },
  nodeById,
  false
)
assert.doesNotMatch(hostileClasses, /<script|onload="attack/u)
assert.match(hostileClasses, /edge-type-calls&quot;&gt;&lt;script&gt;attack&lt;\/script&gt;/u)

state.view = 'domain'
const horizontalDomain = edgeSvg({ from: 'left', to: 'right', type: 'domain-relation' }, nodeById, true, false, true)
assert.match(horizontalDomain, /class="edge domain-edge highlight focused "/u)
assert.match(horizontalDomain, /d="M 110 40 C [\d.]+ 40, [\d.]+ 130, 300 130"/u)

const above = { id: 'above', x: 100, y: 10, width: 80, height: 40 }
const below = { id: 'below', x: 110, y: 300, width: 80, height: 40 }
const verticalNodes = new Map([
  [above.id, above],
  [below.id, below]
])
const verticalDomain = edgeSvg({ from: 'below', to: 'above', type: 'domain-relation' }, verticalNodes, false, true)
assert.match(verticalDomain, /class="edge domain-edge {3}dimmed"/u)
assert.match(verticalDomain, /d="M 150 300 C 150 [\d.]+, 140 [\d.]+, 140 50"/u)

const systemEdge = systemModuleEdgeSvg(
  { from: 'left', to: 'right', count: 7, relationTypes: ['calls-api', `<script>attack</script>`] },
  nodeById
)
assert.match(systemEdge, /d="M 60 40 C 144 40, 276 130, 360 130"/u)
assert.match(systemEdge, /stroke-width="1\.75"/u)
assert.match(systemEdge, /7 relations/u)
assert.doesNotMatch(systemEdge, /<script>/u)
assert.match(systemEdge, /&lt;script&gt;attack&lt;\/script&gt;/u)

console.log('viewer SVG edge tests passed')
