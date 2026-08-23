import assert from 'node:assert/strict'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { createMcpProtocol } from '#mcp/protocol.mjs'
import { findGraphNodes, graphDependencies, graphImpact, graphTrace } from '#mcp/query.mjs'
import { callMcpTool, mcpTools } from '#mcp/tools.mjs'
import { serveMcpStdio } from '#mcp/stdio.mjs'
import { resolveGraphPath, startMcpServer } from '#entry/mcp-server.mjs'
import { nodePlatform } from '#platform/node.mjs'

const graph = {
  version: 1,
  generatedAt: '2030-01-01T00:00:00.000Z',
  projectMap: { project: { name: 'MCP fixture' } },
  stats: { nodes: 4, edges: 3 },
  nodes: [
    node('component', 'Accounts page', 'component', 'frontend'),
    node('service', 'Account service', 'service', 'application'),
    node('repository', 'Account repository', 'repository', 'infrastructure'),
    node('table', 'accounts', 'table', 'database')
  ],
  edges: [
    edge('component:service', 'component', 'service', 'calls'),
    edge('service:repository', 'service', 'repository', 'depends-on'),
    edge('repository:table', 'repository', 'table', 'uses-table')
  ],
  findings: [],
  orphans: []
}

assert.deepEqual(
  findGraphNodes(graph, { query: 'account', type: 'service' }).map(({ id }) => id),
  ['service']
)
assert.deepEqual(
  graphDependencies(graph, { nodeId: 'service', depth: 2 }).nodes.map(({ id }) => id),
  ['service', 'repository', 'table']
)
assert.deepEqual(
  graphImpact(graph, { nodeId: 'repository', depth: 2 }).nodes.map(({ id }) => id),
  ['component', 'service', 'repository']
)
assert.deepEqual(graphTrace(graph, { nodeId: 'component', targetId: 'table' }).paths[0].path, [
  'component',
  'service',
  'repository',
  'table'
])
assert.equal(graphTrace(graph, { nodeId: 'table', targetId: 'component' }).direction, 'incoming')
assert.equal(graphTrace(graph, { nodeId: 'component' }).paths.at(-1).id, 'table')
assert.equal(
  graphDependencies(graph, { nodeId: 'service', direction: 'both', edgeTypes: ['depends-on'] }).edges.length,
  1
)

assert.deepEqual(
  mcpTools.map(({ name }) => name),
  ['find_node', 'dependencies', 'impact', 'trace', 'create_submap']
)
assert.equal(
  callMcpTool(graph, 'create_submap', { id: 'accounts', nodeIds: ['service'], depth: 2 }, nodePlatform).nodes.length,
  4
)
assert.throws(() => callMcpTool(graph, 'impact', {}), /requires nodeId/u)
assert.throws(() => callMcpTool(graph, 'find_node', { unsupported: true }), /does not accept unsupported/u)
assert.throws(() => callMcpTool(graph, 'find_node', { limit: 0 }), /integer between 1 and 100/u)
assert.throws(() => callMcpTool(graph, 'create_submap', { id: 'bad', nodeIds: 'service' }), /non-empty array/u)

const protocol = createMcpProtocol(graph)
const discover = await request(protocol, 'server/discover', modernParams())
assert.deepEqual(discover.result.supportedVersions, ['2026-07-28', '2025-11-25'])
assert.equal(discover.result.capabilities.tools.constructor, Object)

const initialize = await request(protocol, 'initialize', {
  protocolVersion: '2025-11-25',
  capabilities: {},
  clientInfo: { name: 'fixture', version: '1' }
})
assert.equal(initialize.result.protocolVersion, '2025-11-25')

const list = await request(protocol, 'tools/list', modernParams())
assert.equal(list.result.resultType, 'complete')
assert.equal(list.result.tools.length, 5)

const call = await request(protocol, 'tools/call', {
  ...modernParams(),
  name: 'impact',
  arguments: { nodeId: 'repository', depth: 1 }
})
assert.equal(call.result.isError, false)
assert.equal(call.result.structuredContent.result.nodes.length, 2)

const missingNode = await request(protocol, 'tools/call', {
  name: 'impact',
  arguments: { nodeId: 'missing' }
})
assert.equal(missingNode.result.isError, true)
assert.match(missingNode.result.content[0].text, /Graph node not found/u)

const malformed = await request(protocol, 'tools/call', { name: 'impact', arguments: {} })
assert.equal(malformed.error.code, -32602)
const unknown = await request(protocol, 'unsupported', {})
assert.equal(unknown.error.code, -32601)
assert.equal(await protocol.handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null)

const unsupported = await request(createMcpProtocol(graph), 'tools/list', {
  _meta: { 'io.modelcontextprotocol/protocolVersion': '1900-01-01' }
})
assert.equal(unsupported.error.code, -32022)
assert.deepEqual(unsupported.error.data.supported, ['2026-07-28', '2025-11-25'])
assert.equal((await request(createMcpProtocol(graph), 'tools/list', {})).error.code, -32600)

const input = new PassThrough()
const output = new PassThrough()
let stdout = ''
output.on('data', (chunk) => {
  stdout += chunk
})
const serving = serveMcpStdio(protocol, { input, output })
input.end('{invalid}\n' + JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'ping', params: {} }) + '\n')
await serving
const lines = stdout.trim().split('\n').map(JSON.parse)
assert.equal(lines[0].error.code, -32700)
assert.deepEqual(lines[1], { jsonrpc: '2.0', id: 9, result: {} })

const serverInput = new PassThrough()
const serverOutput = new PassThrough()
let serverStdout = ''
serverOutput.on('data', (chunk) => {
  serverStdout += chunk
})
const platform = {
  environment: { cwd: () => 'C:/fixture', variable: () => undefined },
  fileSystem: { readText: () => JSON.stringify(graph) },
  clock: nodePlatform.clock,
  hash: nodePlatform.hash
}
assert.equal(resolveGraphPath([], 'C:/fixture', platform), path.resolve('C:/fixture', '.code-map/graph.json'))
const server = startMcpServer({
  args: ['--graph', 'custom.json'],
  repoRoot: 'C:/fixture',
  platform,
  input: serverInput,
  output: serverOutput
})
serverInput.end(
  JSON.stringify({ jsonrpc: '2.0', id: 10, method: 'initialize', params: { protocolVersion: '2025-11-25' } }) + '\n'
)
await server
assert.equal(JSON.parse(serverStdout).result.protocolVersion, '2025-11-25')
assert.throws(() => resolveGraphPath(['--graph'], 'C:/fixture', platform), /requires a path/u)

console.log('MCP protocol and graph query tests passed')

function request(protocol, method, params) {
  return protocol.handle({ jsonrpc: '2.0', id: 1, method, params })
}

function modernParams() {
  return { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } }
}

function node(id, label, type, layer) {
  return { id, label, type, layer, module: 'accounts', path: `src/${id}.ts`, meta: {} }
}

function edge(id, from, to, type) {
  return { id: `${from}::${type}::${to}`, from, to, type, label: type, confidence: 'high', source: 'fixture' }
}
