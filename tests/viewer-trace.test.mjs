import assert from 'node:assert/strict'
import { buildModuleTraceContext, buildSystemModuleGraph, buildTraceContext } from '../viewer/viewer-trace.js'

const nodes = [
  ['route', 'Routes', 'route'],
  ['component', 'Feature', 'component'],
  ['hook', 'Feature', 'hook'],
  ['front-repository', 'Frontend Repositories', 'repository'],
  ['endpoint', 'API Endpoints', 'endpoint'],
  ['controller', 'Controllers', 'controller'],
  ['query', 'Application', 'query'],
  ['handler', 'Application', 'handler'],
  ['backend-repository', 'Persistence', 'repository'],
  ['entity', 'Domain', 'entity'],
  ['table', 'Database', 'table']
].map(([id, layer, type]) => ({ id, label: id, layer, type, module: 'feature' }))

const relations = [
  ['route', 'component', 'imports', 'high'],
  ['component', 'hook', 'imports', 'high'],
  ['hook', 'front-repository', 'imports', 'high'],
  ['front-repository', 'endpoint', 'calls-api', 'medium'],
  ['endpoint', 'controller', 'handled-by', 'high'],
  ['endpoint', 'query', 'sends', 'high'],
  ['query', 'handler', 'handled-by', 'high'],
  ['handler', 'backend-repository', 'depends-on', 'high'],
  ['handler', 'table', 'queries-table', 'high'],
  ['backend-repository', 'entity', 'uses-entity', 'high'],
  ['entity', 'table', 'maps-to-table', 'high']
]
const edges = relations.map(([from, to, type, confidence]) => ({
  id: `${from}:${type}:${to}`,
  from,
  to,
  type,
  confidence
}))
const graph = { nodes, edges }

const forward = buildTraceContext(graph, 'component', false)
assert.equal(forward.complete, true)
assert.deepEqual(
  [...forward.primaryNodeIds],
  [
    'route',
    'component',
    'hook',
    'front-repository',
    'endpoint',
    'query',
    'handler',
    'backend-repository',
    'entity',
    'table'
  ]
)
assert.equal(
  forward.nodeIds.has('controller'),
  false,
  'controller implementation detail should not interrupt the execution trace'
)

const reverse = buildTraceContext(graph, 'table', false)
assert.equal(reverse.complete, true)
assert.deepEqual(
  [...reverse.primaryNodeIds],
  [
    'route',
    'component',
    'hook',
    'front-repository',
    'endpoint',
    'query',
    'handler',
    'backend-repository',
    'entity',
    'table'
  ]
)

const moduleOverview = buildModuleTraceContext(graph, 'feature')
assert.equal(moduleOverview.moduleOverview, true)
assert.equal(moduleOverview.nodeIds.has('route'), true)
assert.equal(moduleOverview.nodeIds.has('table'), true)
assert.equal(
  moduleOverview.nodeIds.has('controller'),
  false,
  'module execution lanes should omit controller implementation detail'
)

const fallbackNodes = [
  { id: 'app-routes', label: 'AppRoutes', layer: 'Routes', type: 'route', module: 'app', path: 'front/AppRoutes.tsx' },
  { id: 'local-route', label: 'UsersRoutes', layer: 'Routes', type: 'route', module: 'users' },
  { id: 'local-page', label: 'UserCreatePage', layer: 'Views', type: 'page', module: 'users' },
  { id: 'selected-field', label: 'BasicInfo', layer: 'Components', type: 'subcomponent', module: 'users' },
  { id: 'other-route', label: 'DealsRoutes', layer: 'Routes', type: 'route', module: 'deals' },
  { id: 'other-table', label: 'Deals', layer: 'Database', type: 'table', module: 'deals' }
]
const fallbackRelations = [
  ['app-routes', 'local-route', 'imports'],
  ['local-route', 'local-page', 'imports'],
  ['local-page', 'selected-field', 'imports'],
  ['app-routes', 'other-route', 'imports'],
  ['other-route', 'other-table', 'queries-table']
]
const fallbackEdges = fallbackRelations.map(([from, to, type]) => ({
  id: `${from}:${type}:${to}`,
  from,
  to,
  type,
  confidence: 'high'
}))
const fallbackGraph = {
  nodes: fallbackNodes,
  edges: fallbackEdges,
  projectMap: { frontend: { entryPoints: ['front/AppRoutes.tsx'] } }
}
const isolatedFallback = buildTraceContext(fallbackGraph, 'selected-field', false)
assert.equal(isolatedFallback.complete, false, 'a component must not borrow persistence from another feature')
assert.equal(isolatedFallback.nodeIds.has('other-route'), false)
assert.equal(isolatedFallback.nodeIds.has('other-table'), false)
const systemModules = buildSystemModuleGraph(fallbackGraph)
assert.equal(systemModules.nodes.length, 3, 'the system graph should aggregate every visible module')
assert.equal(systemModules.edges.length, 2, 'cross-module relations should be aggregated instead of truncated')

const intentNodes = [
  { id: 'intent-route', label: 'UsersRoutes', type: 'route', module: 'users' },
  { id: 'create-page', label: 'UserCreatePage', type: 'page', module: 'users' },
  { id: 'users-repository', label: 'UsersRepository', type: 'repository', layer: 'front-repository', module: 'users' },
  {
    id: 'get-users',
    label: 'GET /api/users',
    type: 'endpoint',
    module: 'users',
    meta: { method: 'GET', backend: { action: 'GetUsers' } }
  },
  {
    id: 'create-user',
    label: 'POST /api/users',
    type: 'endpoint',
    module: 'users',
    meta: { method: 'POST', backend: { action: 'CreateUser' } }
  },
  { id: 'get-query', label: 'GetUsersQuery', type: 'query', module: 'users' },
  { id: 'create-command', label: 'CreateUserCommand', type: 'command', module: 'users' },
  { id: 'get-handler', label: 'GetUsersQueryHandler', type: 'handler', module: 'users' },
  { id: 'create-handler', label: 'CreateUserCommandHandler', type: 'handler', module: 'users' },
  { id: 'users-table', label: 'Users', type: 'table', module: 'users' }
]
const intentRelations = [
  ['intent-route', 'create-page', 'imports'],
  ['create-page', 'users-repository', 'imports'],
  ['users-repository', 'get-users', 'calls-api'],
  ['users-repository', 'create-user', 'calls-api'],
  ['get-users', 'get-query', 'sends'],
  ['create-user', 'create-command', 'sends'],
  ['get-query', 'get-handler', 'handled-by'],
  ['create-command', 'create-handler', 'handled-by'],
  ['get-handler', 'users-table', 'queries-table'],
  ['create-handler', 'users-table', 'queries-table']
]
const intentEdges = intentRelations.map(([from, to, type]) => ({
  id: `${from}:${type}:${to}`,
  from,
  to,
  type,
  confidence: 'high'
}))
const createTrace = buildTraceContext({ nodes: intentNodes, edges: intentEdges }, 'create-page', false)
assert.equal(
  createTrace.primaryNodeIds.includes('create-user'),
  true,
  'a create page should prefer its create endpoint'
)
assert.equal(
  createTrace.primaryNodeIds.includes('get-users'),
  false,
  'a shorter read path must not replace the selected create flow'
)

console.log('viewer trace tests passed')
