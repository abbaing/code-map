import assert from 'node:assert/strict'
import { Graph } from '../graph.mjs'
import { attachFindingsToNodes, createFindingCollector } from '../rules/findings.mjs'
import { runFileRules } from '../rules/rule-runner.mjs'

const first = createFindingCollector({
  rules: {
    suppressions: [{ ruleId: 'architecture.demo', pathPattern: 'src/**', reason: 'accepted for this fixture' }]
  }
})
const second = createFindingCollector({ rules: { suppressions: [] } })

first.sink.add({
  ruleId: 'architecture.demo',
  severity: 'error',
  nodeId: 'file:src/demo.ts',
  path: 'src/demo.ts',
  line: 3,
  message: 'Demo finding'
})
second.sink.add({
  ruleId: 'architecture.other',
  nodeId: 'file:src/other.ts',
  path: 'src/other.ts',
  message: 'Independent finding'
})

assert.equal(first.source.all().length, 1)
assert.equal(first.source.active().length, 0)
assert.equal(first.source.suppressed()[0].suppression.reason, 'accepted for this fixture')
assert.equal(second.source.active()[0].ruleId, 'architecture.other')
assert.equal(Object.isFrozen(first.sink), true)
assert.equal(Object.isFrozen(first.source), true)
assert.equal(Object.isFrozen(first.source.all()), true)
assert.equal(Object.isFrozen(first.source.suppressed()[0].suppression), true)
assert.throws(() => first.source.all().push({}), TypeError)

const graph = new Graph()
graph.addNode('file:src/other.ts', { label: 'other.ts' })
attachFindingsToNodes(graph, second.source.active())
assert.equal(graph.getNode('file:src/other.ts').meta.findings[0].ruleId, 'architecture.other')

assert.throws(
  () => runFileRules([], [], {}, {}, { projectMap: {} }),
  /requires a finding sink/u,
  'rule execution must reject hidden output channels'
)

console.log('finding collector tests passed')
