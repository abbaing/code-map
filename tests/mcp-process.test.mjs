import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'code-map-mcp-'))
const graphPath = path.join(temporaryDirectory, 'graph.json')

try {
  fs.writeFileSync(graphPath, JSON.stringify(graphFixture()), 'utf8')
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } }
  }
  const result = spawnSync(process.execPath, [path.join(repositoryRoot, 'mcp-server.mjs'), '--graph', graphPath], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    input: `${JSON.stringify(request)}\n`,
    timeout: 10_000
  })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stderr, '')
  const response = JSON.parse(result.stdout)
  assert.equal(response.id, 1)
  assert.equal(response.result.resultType, 'complete')
  assert.deepEqual(
    response.result.tools.map(({ name }) => name),
    ['find_node', 'dependencies', 'impact', 'trace', 'create_submap']
  )
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true })
}

console.log('MCP process smoke test passed')

function graphFixture() {
  return {
    version: 1,
    generatedAt: '2030-01-01T00:00:00.000Z',
    projectMap: { project: { name: 'MCP process fixture' } },
    stats: { nodes: 1, edges: 0 },
    nodes: [
      {
        id: 'service',
        label: 'Account service',
        type: 'service',
        layer: 'application',
        module: 'accounts',
        path: 'src/service.ts',
        meta: {}
      }
    ],
    edges: [],
    findings: [],
    orphans: []
  }
}
