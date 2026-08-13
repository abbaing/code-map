import assert from 'node:assert/strict'
import { buildTraceContext } from '#viewer/viewer-trace.js'

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

console.log('viewer trace intent tests passed')
