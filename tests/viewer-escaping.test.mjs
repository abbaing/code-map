import assert from 'node:assert/strict'
import { nodeDomainSvg, nodeGraphSvg } from '#viewer/viewer-svg-nodes.js'
import { escapeHtml, fillSelect, pillHtml } from '#viewer/viewer-utils.js'
import { colors, state } from '#viewer/viewer-state.js'

const hostile = `<script data-value="double" data-alt='single'>& attack</script>`
assert.equal(
  escapeHtml(hostile),
  '&lt;script data-value=&quot;double&quot; data-alt=&#39;single&#39;&gt;&amp; attack&lt;/script&gt;'
)
assert.equal(escapeHtml(null), '')
assert.equal(escapeHtml(42), '42')

const pill = pillHtml('status-class', hostile, hostile)
assert.doesNotMatch(pill, /<script/u)
assert.match(pill, /title="&lt;script data-value=&quot;double&quot;/u)
assert.match(pill, /aria-label="&lt;script data-value=&quot;double&quot;/u)
assert.match(pill, />&lt;script data-value=&quot;double&quot;/u)

const select = { innerHTML: '' }
fillSelect(select, ['all', `users"><img src=x onerror='attack'>`], 'All modules')
assert.doesNotMatch(select.innerHTML, /<img|onerror='attack'/u)
assert.match(select.innerHTML, /value="users&quot;&gt;&lt;img src=x onerror=&#39;attack&#39;&gt;"/u)

Object.assign(state, { selectedId: null, trace: null })
Object.assign(colors, {})
const hostileNode = {
  id: `endpoint"><script>attack</script>`,
  label: hostile,
  type: 'endpoint',
  module: `users"><img src=x onerror='attack'>`,
  layer: 'ui-page',
  x: 10,
  y: 20,
  width: 180,
  height: 64,
  meta: { backend: { action: hostile } }
}
const graphMarkup = nodeGraphSvg(hostileNode, false)
assert.doesNotMatch(graphMarkup, /<script|<img/u)
assert.match(graphMarkup, /data-id="endpoint&quot;&gt;&lt;script&gt;attack&lt;\/script&gt;"/u)
assert.match(graphMarkup, /&lt;script data-value=&quot;double&quot;/u)

const entityMarkup = nodeDomainSvg(
  {
    ...hostileNode,
    type: 'entity',
    meta: { domain: { properties: [{ name: hostile, type: `text"><script>attack</script>` }] } }
  },
  false
)
assert.doesNotMatch(entityMarkup, /<script/u)
assert.match(entityMarkup, /&lt;script data-value=&quot;double/u)

console.log('viewer escaping tests passed')
