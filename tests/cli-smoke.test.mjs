import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(testDir, '..')
const cliPath = path.join(packageRoot, 'cli.mjs')
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'code-map-cli-'))

function run(args, cwd = tempRoot) {
  return execFileSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, CODE_MAP_CONFIG: '' }
  })
}

const help = run(['--help'])
assert.match(help, /code-map - architectural graph generator/u)

const templates = run(['--templates'])
assert.match(templates, /^base\s+core/mu)
assert.match(templates, /^typescript\s+technology/mu)

const appRoot = path.join(tempRoot, 'app')
fs.mkdirSync(path.join(appRoot, 'src'), { recursive: true })
fs.writeFileSync(
  path.join(appRoot, 'package.json'),
  JSON.stringify({ name: 'cli-smoke-app', dependencies: { react: '18.0.0', 'react-dom': '18.0.0' } }),
  'utf8'
)
fs.writeFileSync(path.join(appRoot, 'src/index.tsx'), 'export function App() { return null }\n', 'utf8')

const initOutput = run(['--init', '--out', tempRoot], appRoot)
assert.match(initOutput, /Detected: react frontend, none backend/u)

const configPath = path.join(tempRoot, 'cli-smoke-app.project-map.json')
assert.equal(fs.existsSync(configPath), true, '--init should write a project-map file')
assert.equal(JSON.parse(fs.readFileSync(configPath, 'utf8')).project.graphOutput, '.code-map/graph.json')

const graphPath = path.join(tempRoot, 'graph.json')
const scanOutput = run(['--scan', '--config', configPath, '--out', graphPath], appRoot)
assert.match(scanOutput, /Scan complete:/u)
assert.equal(fs.existsSync(graphPath), true, '--scan should write graph output')

const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'))
assert.equal(graph.projectMap.sourceRoots.frontend, 'src')
assert.equal(graph.stats.backFiles, 0)

fs.writeFileSync(path.join(appRoot, 'graph.json'), `${JSON.stringify({
  version: 1,
  projectMap: { project: { name: 'Legacy CLI Smoke App' } },
  nodes: [],
  edges: [],
  stats: { nodes: 0, edges: 0 }
}, null, 2)}\n`, 'utf8')
const zeroConfigScan = run(['--scan'], appRoot)
assert.match(zeroConfigScan, /Scan complete:.*-> \.code-map\/graph\.json/u)
assert.equal(
  fs.existsSync(path.join(appRoot, '.code-map', 'graph.json')),
  true,
  'zero-config scans must write generated graphs below .code-map'
)
assert.equal(fs.existsSync(path.join(appRoot, 'graph.json')), false, 'recognized legacy graph output must be removed after migration')

fs.writeFileSync(path.join(appRoot, 'graph.json'), '{"ownedBy":"another-tool"}\n', 'utf8')
run(['--scan'], appRoot)
assert.equal(fs.existsSync(path.join(appRoot, 'graph.json')), true, 'unrecognized root graph files must never be removed')

const arbitraryRoot = path.join(tempRoot, 'arbitrary')
const arbitraryConfigDir = path.join(arbitraryRoot, 'code-map')
const arbitraryTemplatesDir = path.join(arbitraryConfigDir, 'templates')
fs.mkdirSync(path.join(arbitraryRoot, 'src'), { recursive: true })
fs.mkdirSync(arbitraryTemplatesDir, { recursive: true })
fs.writeFileSync(path.join(arbitraryRoot, 'src/index.ts'), 'export const arbitraryValue = 1\n', 'utf8')
fs.writeFileSync(
  path.join(arbitraryTemplatesDir, 'custom-plugin.mjs'),
  "export const customPluginTemplate = { id: 'custom-plugin', stage: 'custom', description: 'Test plugin loaded relative to config.' }\n",
  'utf8'
)

const arbitraryConfigPath = path.join(arbitraryConfigDir, 'project-map.json')
const arbitraryGraphPath = path.join(arbitraryConfigDir, 'graph.json')
const arbitraryConfig = {
  schemaVersion: 1,
  project: {
    name: 'Arbitrary Config App',
    graphOutput: 'graph.json',
    runtimeLinks: 'code-map/runtime-links.json'
  },
  sourceRoots: { frontend: 'src' },
  templates: {
    enabled: ['filesystem', 'typescript', 'react', 'custom-plugin', 'quality'],
    plugins: ['./templates/custom-plugin.mjs']
  },
  imports: { aliases: [] },
  modules: { shared: 'shared', frontendFeaturePattern: '^$', labels: {} },
  layers: [{ id: 'auxiliary', label: 'Auxiliary' }],
  frontend: { entryPoints: [], classifiers: [], coverableTypes: [] },
  rules: { enabled: [], options: {}, suppressions: [] }
}
fs.writeFileSync(arbitraryConfigPath, `${JSON.stringify(arbitraryConfig, null, 2)}\n`, 'utf8')

const arbitraryScan = run(['--scan', '--config', arbitraryConfigPath], arbitraryRoot)
assert.match(arbitraryScan, /Scan complete:/u)
assert.equal(fs.existsSync(arbitraryGraphPath), true, 'a bare graphOutput filename should be resolved beside the project-map file')
const arbitraryGraph = JSON.parse(fs.readFileSync(arbitraryGraphPath, 'utf8'))
assert.equal(arbitraryGraph.templates.includes('custom-plugin'), true, 'plugins should resolve relative to the project-map file')

async function withServer(args, cwd, callback) {
  const port = String(4300 + Math.floor(Math.random() * 1000))
  const child = spawn(process.execPath, [cliPath, ...args], {
    cwd,
    env: { ...process.env, CODE_MAP_PORT: port, CODE_MAP_CONFIG: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  try {
    await waitForServer(port)
    await callback(port)
  } finally {
    child.kill('SIGTERM')
    await new Promise(resolve => child.once('exit', resolve))
  }
}

function request(port, method, pathname, body) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : JSON.stringify(body)
    const req = http.request({
      hostname: 'localhost',
      port,
      path: pathname,
      method,
      headers: payload
        ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        : {}
    }, response => {
      const chunks = []
      response.on('data', chunk => chunks.push(chunk))
      response.on('end', () => resolve({
        status: response.statusCode,
        body: Buffer.concat(chunks).toString('utf8')
      }))
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

function requestRaw(port, method, pathname, payload) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port,
      path: pathname,
      method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, response => {
      const chunks = []
      response.on('data', chunk => chunks.push(chunk))
      response.on('end', () => resolve({
        status: response.statusCode,
        body: Buffer.concat(chunks).toString('utf8')
      }))
    })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

async function waitForServer(port) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await request(port, 'GET', '/', null)
      if (response.status === 200) return
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  throw new Error(`server did not start on port ${port}`)
}

await withServer(['--config', arbitraryConfigPath], arbitraryRoot, async port => {
  const current = JSON.parse((await request(port, 'GET', '/project-map.json')).body)

  const scanResponse = await request(port, 'POST', '/api/scan', {})
  assert.equal(scanResponse.status, 200, 'the running viewer must be able to regenerate its graph')
  const scanResult = JSON.parse(scanResponse.body)
  assert.equal(scanResult.ok, true)
  assert.equal(scanResult.stats.nodes > 0, true)

  const servedGraphResponse = await request(port, 'GET', '/graph.json', null)
  assert.equal(servedGraphResponse.status, 200)
  const servedGraph = JSON.parse(servedGraphResponse.body)
  const traceNodeId = servedGraph.nodes[0].id
  const traceResponse = await request(port, 'POST', '/api/submaps/from-trace', {
    id: 'http-trace',
    nodeIds: [traceNodeId, traceNodeId],
    edgeIds: [],
    selectedNodeId: traceNodeId,
    complete: false
  })
  assert.equal(traceResponse.status, 200, 'a viewer trace must be persisted as a submap')
  const traceResult = JSON.parse(traceResponse.body)
  assert.equal(traceResult.ok, true)
  const tracePath = path.join(arbitraryRoot, traceResult.file)
  assert.equal(fs.existsSync(tracePath), true)
  const traceSubmap = JSON.parse(fs.readFileSync(tracePath, 'utf8'))
  assert.deepEqual(traceSubmap.nodes.map(node => node.id), [traceNodeId], 'trace node ids must be de-duplicated')
  assert.equal(traceSubmap.metadata.kind, 'execution-trace')

  const emptyTrace = await request(port, 'POST', '/api/submaps/from-trace', { id: 'empty-trace', nodeIds: [] })
  assert.equal(emptyTrace.status, 400)
  assert.match(JSON.parse(emptyTrace.body).error, /non-empty trace selection/u)

  current.project.name = 'Saved Arbitrary Config App'
  const response = await request(port, 'POST', '/api/project-map', current)
  assert.equal(response.status, 200, 'settings save should work when started with --config')
  const saved = JSON.parse(fs.readFileSync(arbitraryConfigPath, 'utf8'))
  assert.equal(saved.project.name, 'Saved Arbitrary Config App', 'settings save should write back to the explicit config path')

  const malformedResponse = await requestRaw(port, 'POST', '/api/project-map', '{ not json')
  assert.equal(malformedResponse.status, 400, 'malformed project-map JSON must return a controlled client error')
  assert.equal(JSON.parse(malformedResponse.body).ok, false)

  const configBeforeInvalidSave = fs.readFileSync(arbitraryConfigPath, 'utf8')
  const invalidConfigResponse = await request(port, 'POST', '/api/project-map', {
    schemaVersion: 1,
    project: {},
    sourceRoots: {}
  })
  assert.equal(invalidConfigResponse.status, 400, 'invalid project-map documents must be rejected before persistence')
  assert.match(JSON.parse(invalidConfigResponse.body).error, /project\.name is required/u)
  assert.equal(fs.readFileSync(arbitraryConfigPath, 'utf8'), configBeforeInvalidSave, 'an invalid save must preserve the last valid config')

  const notFound = await request(port, 'GET', '/missing', null)
  assert.equal(notFound.status, 404)

  const graphBackup = fs.readFileSync(arbitraryGraphPath, 'utf8')
  fs.rmSync(arbitraryGraphPath)
  fs.mkdirSync(arbitraryGraphPath)
  try {
    const failedScan = await request(port, 'POST', '/api/scan', {})
    assert.equal(failedScan.status, 500, 'graph write failures must be returned as controlled scan errors')
    assert.equal(JSON.parse(failedScan.body).ok, false)
  } finally {
    fs.rmSync(arbitraryGraphPath, { recursive: true })
    fs.writeFileSync(arbitraryGraphPath, graphBackup, 'utf8')
  }

  const configBackup = fs.readFileSync(arbitraryConfigPath, 'utf8')
  fs.rmSync(arbitraryConfigPath)
  fs.mkdirSync(arbitraryConfigPath)
  try {
    const failedSave = await request(port, 'POST', '/api/project-map', current)
    assert.equal(failedSave.status, 500, 'config write failures must be returned as controlled save errors')
    assert.equal(JSON.parse(failedSave.body).ok, false)
  } finally {
    fs.rmSync(arbitraryConfigPath, { recursive: true })
    fs.writeFileSync(arbitraryConfigPath, configBackup, 'utf8')
  }
})

await withServer([], appRoot, async port => {
  const current = JSON.parse((await request(port, 'GET', '/project-map.json')).body)
  const response = await request(port, 'POST', '/api/project-map', current)
  assert.equal(response.status, 400, 'settings save should be blocked for auto-detected configs')
  assert.match(response.body, /Cannot save an auto-detected project map/u)
})

console.log('cli smoke tests passed')
