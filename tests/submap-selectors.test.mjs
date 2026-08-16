import assert from 'node:assert/strict'
import { SubmapError } from '#submap/errors.mjs'
import { globMatches, resolveSeeds, resolveSelectorNodeIds } from '#submap/selectors.mjs'
import { fixtureGraph } from '#tests/submap-fixture.mjs'

const globCases = [
  ['src/**/*.ts', 'src/index.ts', true],
  ['src/**/*.ts', 'src/auth/AuthService.ts', true],
  ['src/**/*.ts', 'src/auth/AuthService.cs', false],
  ['src/*/index.?s', 'src/auth/index.ts', true],
  ['src/*/index.?s', 'src/auth/nested/index.ts', false],
  ['src/auth/Service.test.ts', 'src/auth/Service.test.ts', true],
  ['src/auth/Service.test.ts', 'src/auth/ServiceXtest.ts', false],
  ['src\\auth\\*.ts', 'src/auth/AuthService.ts', true]
]
for (const [pattern, value, expected] of globCases) {
  assert.equal(globMatches(pattern, value), expected, `${pattern} must ${expected ? '' : 'not '}match ${value}`)
}

const graph = fixtureGraph()
const selectors = {
  nodeIds: ['shared:db'],
  paths: ['src/auth/*Repository.ts'],
  modules: ['auth'],
  layers: ['application'],
  types: ['service']
}
assert.deepEqual(
  [...resolveSelectorNodeIds(graph.nodes, selectors)].sort(),
  ['auth:repo', 'auth:service', 'shared:db'],
  'explicit, path, and attribute selectors must form a set union'
)
assert.deepEqual([...resolveSeeds(graph, selectors)].sort(), ['auth:repo', 'auth:service', 'shared:db'])

const moduleOnly = { nodeIds: [], paths: [], modules: ['billing'], layers: [], types: [] }
assert.deepEqual([...resolveSelectorNodeIds(graph.nodes, moduleOnly)], ['billing:service'])

const noAttributes = { nodeIds: [], paths: ['src/shared/*.ts'], modules: [], layers: [], types: [] }
assert.deepEqual([...resolveSelectorNodeIds(graph.nodes, noAttributes)], ['shared:db'])

assert.throws(
  () => resolveSeeds(graph, { ...noAttributes, nodeIds: ['missing', 'also-missing'] }),
  (error) => {
    assert.equal(error instanceof SubmapError, true)
    assert.equal(error.code, 'SUBMAP_SEED_NOT_FOUND')
    assert.equal(error.exitCode, 3)
    assert.deepEqual(error.details, { nodeIds: ['missing', 'also-missing'] })
    return true
  }
)

const empty = { nodeIds: [], paths: [], modules: [], layers: [], types: [] }
assert.throws(
  () => resolveSeeds(graph, empty),
  (error) => {
    assert.equal(error instanceof SubmapError, true)
    assert.equal(error.code, 'SUBMAP_NO_SEEDS')
    assert.equal(error.exitCode, 3)
    assert.deepEqual(error.details, { selectors: empty })
    return true
  }
)

console.log('submap selector tests passed')
