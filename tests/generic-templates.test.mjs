import assert from 'node:assert/strict'
import { cleanupFixtures, scanArchitectureFixture, scanTypeScriptFixture } from '#tests/generic-template-support.mjs'

const typescriptGraph = scanTypeScriptFixture('typescript-template-fixture')
const typeScriptRules = new Set(typescriptGraph.findings.map((finding) => finding.ruleId))

assert.equal(
  typeScriptRules.has('technology.typescript.relative-imports'),
  true,
  'typescript template should detect relative imports'
)
assert.equal(typeScriptRules.has('technology.typescript.no-any'), true, 'typescript template should detect any')
assert.equal(
  typescriptGraph.findings.filter((finding) => finding.ruleId === 'technology.typescript.no-any').length,
  1,
  'type-safety findings must come from syntax nodes rather than any-shaped string content'
)
assert.equal(
  [...typeScriptRules].every((ruleId) => ruleId.startsWith('technology.') || ruleId.startsWith('framework.')),
  true,
  'generic templates must emit generic rule ids'
)

const architectureGraph = scanArchitectureFixture('architecture-template-fixture')
const architectureRules = new Set(architectureGraph.findings.map((finding) => finding.ruleId))
const testedNode = architectureGraph.nodes.find((node) => node.label === 'tested.ts')
const uncoveredNode = architectureGraph.nodes.find((node) => node.label === 'uncovered.ts')

assert.ok(testedNode, 'the covered fixture source must be scanned')
assert.ok(uncoveredNode, 'the uncovered fixture source must be scanned')
assert.deepEqual(testedNode.meta?.coverage, {
  hasCoverage: true,
  tests: [testedNode.path.replace(/tested\.ts$/u, 'coverage.spec.ts')],
  testCaseCount: 1
})
assert.equal(
  uncoveredNode?.meta?.coverage,
  undefined,
  'import-shaped strings in tests must not attribute source coverage'
)

for (const ruleId of [
  'framework.react.component-folder-entry',
  'architecture.mvvm.thin-view-entry',
  'architecture.feature-sliced.no-cross-feature-internals',
  'architecture.mvvm.viewmodel-hook-naming',
  'architecture.layered.no-ui-imports-in-data-adapters',
  'architecture.mvc.thin-controller',
  'architecture.clean-architecture.layer-boundaries'
]) {
  assert.equal(architectureRules.has(ruleId), true, `architecture fixture should emit ${ruleId}`)
}

const architectureNodes = new Map(architectureGraph.nodes.map((node) => [node.label, node]))
const architectureOrphans = new Set(architectureGraph.orphans.map((orphan) => orphan.label))

assert.equal(
  ['command', 'query'].includes(architectureNodes.get('ICommand.cs')?.type),
  false,
  'marker interfaces must not be classified as request nodes'
)
assert.equal(
  architectureNodes.get('CreateAccountCommand')?.type,
  'command',
  'commands under /Commands/ should be classified as command nodes'
)
assert.equal(
  architectureOrphans.has('CreateAccountCommand'),
  false,
  'a [FromBody] dispatched command must receive a sends edge from its controller'
)
assert.equal(
  architectureOrphans.has('NotifyAccountCommand'),
  false,
  'a command dispatched from an application handler must receive a sends edge'
)

const orphanPaths = new Set(architectureGraph.orphans.map((orphan) => orphan.path))
const duplicateRequestPaths = architectureGraph.nodes
  .filter((node) => node.path?.endsWith('/Queries/GetStatusQuery.cs'))
  .map((node) => node.path)

assert.equal(duplicateRequestPaths.length, 2, 'fixture should expose the same request name in two modules')
for (const requestPath of duplicateRequestPaths) {
  assert.equal(
    orphanPaths.has(requestPath),
    false,
    `same-named request in distinct modules must each be linked to its own dispatcher (${requestPath})`
  )
}

assert.equal(
  architectureOrphans.has('GhostCommand.cs'),
  true,
  'a command only referenced inside a comment must not receive a sends edge'
)

const createEndpoint = architectureGraph.nodes.find((node) => node.id === 'endpoint:POST /api/accounts')
const archiveEndpoint = architectureGraph.nodes.find((node) => node.id === 'endpoint:DELETE /api/accounts/{}')
const createSends = architectureGraph.edges.filter((edge) => edge.from === createEndpoint?.id && edge.type === 'sends')
const archiveSends = architectureGraph.edges.filter(
  (edge) => edge.from === archiveEndpoint?.id && edge.type === 'sends'
)
assert.deepEqual(
  createSends.map((edge) => architectureGraph.nodes.find((node) => node.id === edge.to)?.label),
  ['CreateAccountCommand'],
  'an endpoint must only dispatch the request used by its own controller action'
)
assert.deepEqual(
  archiveSends.map((edge) => architectureGraph.nodes.find((node) => node.id === edge.to)?.label),
  ['ArchiveAccountCommand'],
  'a second controller action must keep an independent request trace'
)
assert.equal(
  createEndpoint?.meta?.backend?.action,
  'Create',
  'endpoint metadata should describe the controller action without requiring a controller node in the trace'
)

cleanupFixtures()
console.log('generic template rule tests passed')
