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

const graphPath = path.join(tempRoot, 'graph.json')
const scanOutput = run(['--scan', '--config', configPath, '--out', graphPath], appRoot)
assert.match(scanOutput, /Scan complete:/u)
assert.equal(fs.existsSync(graphPath), true, '--scan should write graph output')

const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'))
assert.equal(graph.projectMap.sourceRoots.frontend, 'src')
assert.equal(graph.stats.backFiles, 0)

const arbitraryRoot = path.join(tempRoot, 'arbitrary')
const arbitraryConfigDir = path.join(arbitraryRoot, 'docs/03-technical/code-map')
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
    graphOutput: 'docs/03-technical/code-map/graph.json',
    runtimeLinks: 'docs/03-technical/code-map/runtime-links.json'
  },
  sourceRoots: { frontend: 'src' },
  templates: {
    enabled: ['filesystem', 'typescript', 'custom-plugin', 'quality'],
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
assert.equal(fs.existsSync(arbitraryGraphPath), true, 'graphOutput should be resolved from the execution cwd')
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
  current.project.name = 'Saved Arbitrary Config App'
  const response = await request(port, 'POST', '/api/project-map', current)
  assert.equal(response.status, 200, 'settings save should work when started with --config')
  const saved = JSON.parse(fs.readFileSync(arbitraryConfigPath, 'utf8'))
  assert.equal(saved.project.name, 'Saved Arbitrary Config App', 'settings save should write back to the explicit config path')
})

await withServer([], appRoot, async port => {
  const current = JSON.parse((await request(port, 'GET', '/project-map.json')).body)
  const response = await request(port, 'POST', '/api/project-map', current)
  assert.equal(response.status, 400, 'settings save should be blocked for auto-detected configs')
  assert.match(response.body, /Cannot save an auto-detected project map/u)
})

console.log('cli smoke tests passed')
