import assert from 'node:assert/strict'
import {
  clearSelectedNode,
  configureViewerSelection,
  connectedEdgeIds,
  hidePopover,
  movePopover,
  selectNode,
  showPopover
} from '#viewer/viewer-selection.js'
import { configureViewerElements, state } from '#viewer/viewer-state.js'

const hostile = `<img src=x onerror="attack">`
const detailedNode = {
  id: 'accounts-page',
  label: `Accounts ${hostile}`,
  type: 'page',
  module: 'accounts',
  meta: {
    coverage: { hasCoverage: true, tests: [`accounts-${hostile}.test.tsx`] },
    review: { reason: `Review ${hostile}` },
    findings: [{ ruleId: 'frontend.no-any', severity: `error-${hostile}` }],
    quality: {
      score: 8,
      summary: `Quality ${hostile}`,
      cohesion: { score: 9, reason: `Cohesion ${hostile}` },
      coupling: { score: 7, reason: `Coupling ${hostile}` },
      internalComponents: [
        { label: `Form ${hostile}`, score: 6 },
        { label: 'Table', score: 7, summary: `Summary ${hostile}` }
      ],
      related: [{ label: `Service ${hostile}`, type: 'service', module: 'accounts' }]
    }
  }
}
const graph = {
  nodes: [detailedNode, { id: 'plain', label: 'Plain', type: 'component', module: 'accounts', meta: {} }],
  edges: [
    { id: 'incoming', from: 'plain', to: 'accounts-page' },
    { id: 'outgoing', from: 'accounts-page', to: 'missing' },
    { id: 'unrelated', from: 'plain', to: 'missing' }
  ]
}
const popover = {
  innerHTML: '',
  offsetWidth: 200,
  offsetHeight: 100,
  style: { display: 'none', left: '', top: '' }
}
configureViewerElements({ popover })
globalThis.window = { innerWidth: 1000, innerHeight: 800 }
Object.assign(state, { graph, selectedId: null, showAllTrace: true, trace: null, view: 'overview' })

showPopover({ clientX: 980, clientY: 780 }, detailedNode.id)
assert.equal(popover.style.display, 'block')
assert.equal(popover.style.left, '788px')
assert.equal(popover.style.top, '688px')
assert.doesNotMatch(popover.innerHTML, /<img|onerror="attack"/u)
for (const expected of ['Findings', 'Needs review', 'Coverage', 'Score 8/10', 'Internal components', 'Related']) {
  assert.match(popover.innerHTML, new RegExp(expected, 'u'))
}
assert.match(popover.innerHTML, /Supporting component score/u)
assert.match(popover.innerHTML, /Service &lt;img/u)

movePopover({ clientX: -50, clientY: -30 })
assert.equal(popover.style.left, '12px')
assert.equal(popover.style.top, '12px')
hidePopover()
assert.equal(popover.style.display, 'none')

popover.innerHTML = 'unchanged'
showPopover({ clientX: 100, clientY: 100 }, 'plain')
assert.equal(popover.innerHTML, 'unchanged')
showPopover({ clientX: 100, clientY: 100 }, 'missing')
assert.equal(popover.innerHTML, 'unchanged')

assert.deepEqual([...connectedEdgeIds(detailedNode.id)], ['incoming', 'outgoing'])
assert.deepEqual([...connectedEdgeIds(null)], [])

state.selectedId = null
assert.throws(() => selectNode(detailedNode.id), /operations are not configured/u)

let detailRenders = 0
configureViewerSelection({
  renderModuleDetail() {
    detailRenders++
  }
})
state.showAllTrace = true
state.trace = { nodeIds: new Set([detailedNode.id]) }
selectNode(detailedNode.id)
assert.equal(state.selectedId, detailedNode.id)
assert.equal(state.showAllTrace, false)
assert.equal(detailRenders, 1)
assert.equal(popover.style.display, 'none')

clearSelectedNode()
assert.equal(state.selectedId, null)
assert.equal(state.showAllTrace, false)
assert.equal(state.trace, null)
assert.equal(detailRenders, 2)

clearSelectedNode()
assert.equal(detailRenders, 2, 'clearing an empty selection must not rerender its detail')

delete globalThis.window
console.log('viewer selection behavior tests passed')
