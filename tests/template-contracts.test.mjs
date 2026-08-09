import assert from 'node:assert/strict'
import { capabilityInput, assertTemplate } from '#templates/contracts.mjs'
import { buildTemplateRegistry, registerTemplate } from '#templates/registry.mjs'

assert.throws(() => assertTemplate({}), /Template id must be a non-empty string/u)
assert.throws(() => assertTemplate({ id: 'missing-description' }), /description must be a non-empty string/u)
assert.throws(
  () =>
    assertTemplate({
      id: 'missing-requirements',
      description: 'Invalid scanner fixture.',
      capabilities: { scanners: [{ id: 'scanner', run() {} }] }
    }),
  /requirements must be an array/u
)
assert.throws(
  () =>
    assertTemplate({
      id: 'duplicate-capability',
      description: 'Duplicate scanner fixture.',
      capabilities: {
        scanners: [
          { id: 'scanner', requires: [], run() {} },
          { id: 'scanner', requires: [], run() {} }
        ]
      }
    }),
  /duplicate scanner id/u
)
assert.throws(
  () => assertTemplate({ id: 'invalid-shape', description: 'Invalid shape.', capabilities: [] }),
  /capabilities must be an object/u
)

const capability = {
  id: 'focused',
  requires: ['graph'],
  optionalRequires: ['findingSink'],
  run() {}
}
const graph = { id: 'graph' }
const findingSink = { add() {} }
const input = capabilityInput(capability, { graph, findingSink, hidden: true })
assert.deepEqual(Object.keys(input), ['graph', 'findingSink'])
assert.equal(input.graph, graph)
assert.equal(Object.isFrozen(input), true)
assert.throws(() => capabilityInput(capability, { findingSink }), /missing required input: graph/u)

registerTemplate({
  id: 'contract-fixture',
  stage: 'test',
  description: 'Validates runtime template registration.',
  capabilities: {
    scanners: [{ id: 'contract-fixture.scan', requires: ['graph'], run: ({ graph: value }) => value }]
  }
})
assert.throws(
  () => registerTemplate({ id: 'contract-fixture', description: 'Duplicate template fixture.' }),
  /Duplicate template id/u
)
const registry = buildTemplateRegistry({ templates: { enabled: ['contract-fixture'] } })
assert.equal(Object.isFrozen(registry), true)
assert.equal(Object.isFrozen(registry.capabilities.scanners), true)
assert.deepEqual(registry.capabilities.scanners[0].requires, ['graph'])

registerTemplate({
  id: 'duplicate-contract-capability',
  description: 'Duplicates a capability in another template.',
  capabilities: {
    scanners: [{ id: 'contract-fixture.scan', requires: [], run() {} }]
  }
})
assert.throws(
  () => buildTemplateRegistry({ templates: { enabled: ['contract-fixture', 'duplicate-contract-capability'] } }),
  /duplicate scanner id/u
)

console.log('template contract tests passed')
