import assert from 'node:assert/strict'
import { createScanPipeline, defineScanPhase } from '#core/scan-pipeline.mjs'
import { createDefaultScanPipeline } from '#app/scan.mjs'

const calls = []
const pipeline = createScanPipeline([
  defineScanPhase({
    id: 'discover',
    requires: ['seed'],
    provides: ['files'],
    run(input) {
      calls.push('discover')
      assert.deepEqual(Object.keys(input), ['seed'])
      assert.equal(Object.isFrozen(input), true)
      return { files: [input.seed] }
    }
  }),
  {
    id: 'analyze',
    requires: ['files'],
    provides: ['count'],
    run({ files }) {
      calls.push('analyze')
      return { count: files.length }
    }
  }
])

const result = pipeline.run({ seed: 'entry.ts', privateValue: 'not exposed to phases' })
assert.deepEqual(calls, ['discover', 'analyze'], 'phases must execute in declaration order')
assert.equal(result.count, 1)
assert.equal(result.privateValue, 'not exposed to phases')
assert.equal(Object.isFrozen(result), true, 'completed pipeline state must be immutable')
assert.equal(Object.isFrozen(pipeline.phases), true)

assert.throws(() => defineScanPhase(), /phase id is required/u)
assert.throws(() => defineScanPhase({ id: 'invalid' }), /must implement run/u)
assert.throws(() => createScanPipeline([]), /requires at least one phase/u)
assert.throws(
  () =>
    createScanPipeline([
      { id: 'same', run() {} },
      { id: 'same', run() {} }
    ]),
  /Duplicate scan phase id/u
)
assert.throws(
  () =>
    createScanPipeline([
      { id: 'first', provides: ['value'], run: () => ({ value: 1 }) },
      { id: 'second', provides: ['value'], run: () => ({ value: 2 }) }
    ]),
  /provided by both/u
)
assert.throws(
  () => createScanPipeline([{ id: 'missing', requires: ['value'], run() {} }]).run(),
  /missing required input: value/u
)
assert.throws(
  () => createScanPipeline([{ id: 'undeclared', run: () => ({ value: 1 }) }]).run(),
  /returned undeclared output: value/u
)
assert.throws(
  () => createScanPipeline([{ id: 'absent', provides: ['value'], run() {} }]).run(),
  /did not provide declared output: value/u
)
assert.throws(
  () => createScanPipeline([{ id: 'invalid-output', run: () => [] }]).run(),
  /must return an output object/u
)

assert.deepEqual(
  createDefaultScanPipeline().phases.map((phase) => phase.id),
  ['discover-files', 'run-scanners', 'apply-runtime-links', 'run-enrichers', 'finalize-document'],
  'the default scan order must remain explicit and reviewable'
)
const defaultPhases = createDefaultScanPipeline().phases
const scannerPhase = defaultPhases.find((phase) => phase.id === 'run-scanners')
const enricherPhase = defaultPhases.find((phase) => phase.id === 'run-enrichers')
assert.deepEqual(scannerPhase.provides, ['scannerResults'])
assert.equal(enricherPhase.requires.includes('scannerResults'), true)
assert.equal(
  defaultPhases.some((phase) => [...phase.requires, ...phase.provides].includes('scanContext')),
  false
)

console.log('scan pipeline contract tests passed')
