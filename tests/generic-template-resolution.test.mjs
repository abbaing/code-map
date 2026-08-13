import assert from 'node:assert/strict'
import { cleanupFixtures, scanArchitectureFixture } from '#tests/generic-template-support.mjs'

const architectureGraph = scanArchitectureFixture('architecture-resolution-fixture')
const handlerNode = architectureGraph.nodes.find((node) => node.label === 'CreateAccountCommandHandler.cs')
const repositoryNode = architectureGraph.nodes.find((node) => node.label === 'AccountRepository.cs')
assert.equal(repositoryNode?.type, 'repository', 'backend repository implementations should have an architectural role')
assert.equal(
  repositoryNode?.layer,
  'backend-repository',
  'backend repositories should render after application handlers'
)
assert.equal(
  architectureGraph.edges.some(
    (edge) => edge.from === handlerNode?.id && edge.to === repositoryNode?.id && edge.type === 'depends-on'
  ),
  true,
  'constructor injection should connect a handler to the implementation of its repository interface'
)

const commentedImportEdge = architectureGraph.edges.find(
  (edge) =>
    edge.type === 'imports' &&
    edge.from.endsWith('/reports/hooks/useReports.ts') &&
    edge.to.endsWith('/reports/components/Widget.tsx')
)
assert.equal(commentedImportEdge, undefined, 'a commented-out import must not create an imports edge')

assert.equal(
  architectureGraph.nodes.find((node) => node.label === 'ReportsPage')?.type,
  'page',
  'a page directory entry should remain a page'
)
assert.equal(
  architectureGraph.nodes.find((node) => node.label === '_DateRangeSelector')?.type,
  'subcomponent',
  'nested page UI must not become a top-level page'
)
assert.equal(
  architectureGraph.nodes.find((node) => node.path?.endsWith('/reports/pages/index.ts'))?.type,
  'auxiliary',
  'a pages barrel is not a routeable page'
)

const importedConstantEndpoint = architectureGraph.nodes.find((node) => node.id === 'endpoint:GET /api/v1/admin/users')
const importedMutationEndpoint = architectureGraph.nodes.find((node) => node.id === 'endpoint:POST /api/v1/admin/users')
const importedUpdateEndpoint = architectureGraph.nodes.find((node) => node.id === 'endpoint:PUT /api/v1/admin/users/{}')
const usersRepository = architectureGraph.nodes.find((node) =>
  node.path?.endsWith('/users/repositories/UsersRepository.ts')
)
assert.equal(
  architectureGraph.edges.some(
    (edge) => edge.from === usersRepository?.id && edge.to === importedConstantEndpoint?.id && edge.type === 'calls-api'
  ),
  true,
  'frontend API wrappers must resolve imported URL constants, including aliased imports'
)
assert.equal(
  architectureGraph.edges.some(
    (edge) => edge.from === usersRepository?.id && edge.to === importedMutationEndpoint?.id && edge.type === 'calls-api'
  ),
  true,
  'positional HTTP wrappers must preserve POST semantics'
)
assert.equal(
  architectureGraph.edges.some(
    (edge) => edge.from === usersRepository?.id && edge.to === importedUpdateEndpoint?.id && edge.type === 'calls-api'
  ),
  true,
  'positional HTTP wrappers must preserve templated PUT URLs'
)

const fetchEndpoint = architectureGraph.nodes.find((node) => node.id === 'endpoint:GET /api/reports')
assert.equal(fetchEndpoint?.type, 'endpoint', 'native fetch calls should create GET endpoints by default')

for (const edge of architectureGraph.edges) {
  assert.notEqual(edge.source, 'scanner', `${edge.id} must identify the scanner that produced it`)
  assert.equal(typeof edge.source === 'string' && edge.source.length > 0, true, `${edge.id} must declare provenance`)
  assert.equal(typeof edge.evidence === 'string' && edge.evidence.length > 0, true, `${edge.id} must retain evidence`)
}

cleanupFixtures()
console.log('generic template resolution tests passed')
