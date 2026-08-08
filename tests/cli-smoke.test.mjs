import assert from 'node:assert/strict'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startServer } from '../server.mjs'

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

function runResult(args, cwd = tempRoot) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, CODE_MAP_CONFIG: '' }
  })
}

const help = run(['--help'])
assert.match(help, /code-map - architectural graph generator/u)
assert.match(help, /CODE_MAP_HOST\s+Viewer server host \(default: 127\.0\.0\.1\)/u)
assert.match(help, /--allow-plugins\s+Trust and execute configured plugin modules/u)

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

fs.writeFileSync(
  path.join(appRoot, 'graph.json'),
  `${JSON.stringify(
    {
      version: 1,
      projectMap: { project: { name: 'Legacy CLI Smoke App' } },
      nodes: [],
      edges: [],
      stats: { nodes: 0, edges: 0 }
    },
    null,
    2
  )}\n`,
  'utf8'
)
const zeroConfigScan = run(['--scan'], appRoot)
assert.match(zeroConfigScan, /Scan complete:.*-> \.code-map\/graph\.json/u)
assert.equal(
  fs.existsSync(path.join(appRoot, '.code-map', 'graph.json')),
  true,
  'zero-config scans must write generated graphs below .code-map'
)
assert.equal(
  fs.existsSync(path.join(appRoot, 'graph.json')),
  false,
  'recognized legacy graph output must be removed after migration'
)

fs.writeFileSync(path.join(appRoot, 'graph.json'), '{"ownedBy":"another-tool"}\n', 'utf8')
run(['--scan'], appRoot)
assert.equal(
  fs.existsSync(path.join(appRoot, 'graph.json')),
  true,
  'unrecognized root graph files must never be removed'
)

const arbitraryRoot = path.join(tempRoot, 'arbitrary')
const arbitraryConfigDir = path.join(arbitraryRoot, 'code-map')
const arbitraryTemplatesDir = path.join(arbitraryConfigDir, 'templates')
const outsideSourceRoot = path.join(tempRoot, 'outside-source')
const linkedOutsideRoot = path.join(arbitraryRoot, 'linked-outside')
fs.mkdirSync(path.join(arbitraryRoot, 'src'), { recursive: true })
fs.mkdirSync(arbitraryTemplatesDir, { recursive: true })
fs.mkdirSync(outsideSourceRoot)
fs.symlinkSync(outsideSourceRoot, linkedOutsideRoot, process.platform === 'win32' ? 'junction' : 'dir')
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

const refusedPluginScan = runResult(['--scan', '--config', arbitraryConfigPath], arbitraryRoot)
assert.notEqual(refusedPluginScan.status, 0, 'configured plugins must not execute without explicit trust')
assert.match(refusedPluginScan.stderr, /Custom template plugins are disabled by default/u)
assert.equal(fs.existsSync(arbitraryGraphPath), false, 'a refused plugin scan must not generate a graph')
const arbitraryScan = run(['--scan', '--config', arbitraryConfigPath, '--allow-plugins'], arbitraryRoot)
assert.match(arbitraryScan, /Scan complete:/u)
assert.equal(
  fs.existsSync(arbitraryGraphPath),
  true,
  'a bare graphOutput filename should be resolved beside the project-map file'
)
const arbitraryGraph = JSON.parse(fs.readFileSync(arbitraryGraphPath, 'utf8'))
assert.equal(
  arbitraryGraph.templates.includes('custom-plugin'),
  true,
  'plugins should resolve relative to the project-map file'
)
assert.equal('repoRoot' in arbitraryGraph, false, 'generated graphs must not expose the absolute workspace path')
assert.doesNotMatch(
  JSON.stringify(arbitraryGraph),
  new RegExp(arbitraryRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu'),
  'generated graphs must remain portable across workspaces'
)

const localServerMessages = []
const localServer = startServer({
  port: 0,
  application: {},
  log: (message) => localServerMessages.push(message)
})
await new Promise((resolve, reject) => {
  localServer.once('listening', resolve)
  localServer.once('error', reject)
})
const localAddress = localServer.address()
assert.equal(localAddress.address, '127.0.0.1', 'the viewer server must bind to IPv4 loopback by default')
assert.equal(
  localServerMessages[0],
  `Code map available at http://127.0.0.1:${localAddress.port}`,
  'the startup message must report the actual listening address'
)
assert.equal(localServer.requestTimeout, 30_000, 'requests must have a bounded completion time')
assert.equal(localServer.headersTimeout, 10_000, 'headers must have a bounded completion time')
assert.equal(localServer.keepAliveTimeout, 5_000, 'idle keep-alive connections must be short-lived')
assert.equal(localServer.timeout, 30_000, 'inactive sockets must time out')
assert.equal(localServer.maxHeadersCount, 100, 'requests must have a bounded header count')
assert.equal(localServer.maxRequestsPerSocket, 100, 'keep-alive sockets must have a bounded request count')
await new Promise((resolve, reject) => localServer.close((error) => (error ? reject(error) : resolve())))

async function withServer(args, cwd, callback) {
  const port = String(4300 + Math.floor(Math.random() * 1000))
  const child = spawn(process.execPath, [cliPath, ...args], {
    cwd,
    env: { ...process.env, CODE_MAP_PORT: port, CODE_MAP_CONFIG: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  try {
    const session = await waitForServer(port)
    await callback(port, session)
  } finally {
    child.kill('SIGTERM')
    await new Promise((resolve) => child.once('exit', resolve))
  }
}

function request(port, method, pathname, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : JSON.stringify(body)
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path: pathname,
        method,
        headers: {
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers
        }
      },
      (response) => {
        const chunks = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            body: Buffer.concat(chunks).toString('utf8'),
            headers: response.headers
          })
        )
      }
    )
    req.on('error', reject)
    if (payload) {
      req.write(payload)
    }
    req.end()
  })
}

function requestRaw(port, method, pathname, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const contentLength = headers['Transfer-Encoding'] ? {} : { 'Content-Length': Buffer.byteLength(payload) }
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path: pathname,
        method,
        headers: { 'Content-Type': 'application/json', ...contentLength, ...headers }
      },
      (response) => {
        const chunks = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            body: Buffer.concat(chunks).toString('utf8'),
            headers: response.headers
          })
        )
      }
    )
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

async function waitForServer(port) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await request(port, 'GET', '/', null)
      if (response.status === 200) {
        const setCookie = response.headers['set-cookie']?.[0]
        if (!setCookie) {
          throw new Error('server did not issue a viewer session cookie')
        }
        assert.match(
          setCookie,
          /; HttpOnly; SameSite=Strict; Path=\/$/u,
          'the viewer session cookie must not be readable by JavaScript or sent cross-site'
        )
        return {
          Cookie: setCookie.split(';')[0],
          Origin: `http://localhost:${port}`
        }
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  throw new Error(`server did not start on port ${port}`)
}

await withServer(['--config', arbitraryConfigPath, '--allow-plugins'], arbitraryRoot, async (port, session) => {
  const current = JSON.parse((await request(port, 'GET', '/project-map.json')).body)
  const securedViewer = await request(port, 'GET', '/', null)
  const contentSecurityPolicy = securedViewer.headers['content-security-policy']
  assert.match(contentSecurityPolicy, /default-src 'none'/u)
  assert.match(contentSecurityPolicy, /script-src 'self'/u)
  assert.match(contentSecurityPolicy, /script-src-attr 'none'/u, 'inline event handlers must be blocked by policy')
  assert.doesNotMatch(contentSecurityPolicy, /script-src[^;]*'unsafe-inline'/u)
  assert.match(
    contentSecurityPolicy,
    /style-src-attr 'unsafe-inline'/u,
    'the graph layout must retain its constrained dynamic styles'
  )
  assert.match(contentSecurityPolicy, /frame-ancestors 'none'/u)
  assert.equal(securedViewer.headers['x-content-type-options'], 'nosniff')
  assert.equal(securedViewer.headers['x-frame-options'], 'DENY')
  assert.equal(securedViewer.headers['referrer-policy'], 'no-referrer')
  assert.equal(securedViewer.headers['cross-origin-resource-policy'], 'same-origin')
  assert.equal(securedViewer.headers['permissions-policy'], 'camera=(), geolocation=(), microphone=()')
  const localUtilityCss = await request(port, 'GET', '/tailwind.css', null)
  assert.equal(localUtilityCss.status, 200, 'the viewer utility stylesheet must be served locally')
  assert.match(localUtilityCss.headers['content-type'], /^text\/css/u)
  assert.match(localUtilityCss.body, /tailwindcss v4\.3\.3/u)
  assert.equal(
    (await request(port, 'GET', '/viewer-unlisted.js', null)).status,
    404,
    'only explicitly registered viewer assets may be served'
  )

  const missingSession = await request(port, 'POST', '/api/scan', {})
  assert.equal(missingSession.status, 403, 'mutating endpoints must require a viewer session')
  const crossOrigin = await request(port, 'POST', '/api/scan', {}, { ...session, Origin: 'http://attacker.invalid' })
  assert.equal(crossOrigin.status, 403, 'mutating endpoints must reject cross-origin requests')
  const invalidSession = await request(
    port,
    'POST',
    '/api/scan',
    {},
    { ...session, Cookie: 'code-map-session=invalid' }
  )
  assert.equal(invalidSession.status, 403, 'mutating endpoints must reject invalid session tokens')
  const invalidHost = await request(port, 'GET', '/graph.json', null, { Host: `attacker.invalid:${port}` })
  assert.equal(invalidHost.status, 400, 'requests with an untrusted Host header must be rejected')

  const oversizedPayload = JSON.stringify('x'.repeat(1024 * 1024))
  const oversizedDeclared = await requestRaw(port, 'POST', '/api/project-map', oversizedPayload, session)
  assert.equal(oversizedDeclared.status, 413, 'declared request bodies over 1 MiB must be rejected')
  assert.match(oversizedDeclared.body, /Request body exceeds the 1 MiB limit/u)
  const oversizedChunked = await requestRaw(port, 'POST', '/api/project-map', oversizedPayload, {
    ...session,
    'Transfer-Encoding': 'chunked'
  })
  assert.equal(oversizedChunked.status, 413, 'chunked request bodies over 1 MiB must be rejected while streaming')
  assert.equal(
    (await request(port, 'GET', '/graph.json', null)).status,
    200,
    'an oversized request must not destabilize the server'
  )

  const scanResponse = await request(port, 'POST', '/api/scan', {}, session)
  assert.equal(scanResponse.status, 200, 'the running viewer must be able to regenerate its graph')
  const scanResult = JSON.parse(scanResponse.body)
  assert.equal(scanResult.ok, true)
  assert.equal(scanResult.stats.nodes > 0, true)

  const servedGraphResponse = await request(port, 'GET', '/graph.json', null)
  assert.equal(servedGraphResponse.status, 200)
  const servedGraph = JSON.parse(servedGraphResponse.body)
  const traceNodeId = servedGraph.nodes[0].id
  const traceResponse = await request(
    port,
    'POST',
    '/api/submaps/from-trace',
    {
      id: 'http-trace',
      nodeIds: [traceNodeId, traceNodeId],
      edgeIds: [],
      selectedNodeId: traceNodeId,
      complete: false
    },
    session
  )
  assert.equal(traceResponse.status, 200, 'a viewer trace must be persisted as a submap')
  const traceResult = JSON.parse(traceResponse.body)
  assert.equal(traceResult.ok, true)
  const tracePath = path.join(arbitraryRoot, traceResult.file)
  assert.equal(fs.existsSync(tracePath), true)
  const traceSubmap = JSON.parse(fs.readFileSync(tracePath, 'utf8'))
  assert.deepEqual(
    traceSubmap.nodes.map((node) => node.id),
    [traceNodeId],
    'trace node ids must be de-duplicated'
  )
  assert.equal(traceSubmap.metadata.kind, 'execution-trace')

  const emptyTrace = await request(port, 'POST', '/api/submaps/from-trace', { id: 'empty-trace', nodeIds: [] }, session)
  assert.equal(emptyTrace.status, 400)
  assert.match(JSON.parse(emptyTrace.body).error, /non-empty trace selection/u)

  current.project.name = 'Saved Arbitrary Config App'
  const response = await request(port, 'POST', '/api/project-map', current, session)
  assert.equal(response.status, 200, 'settings save should work when started with --config')
  const saved = JSON.parse(fs.readFileSync(arbitraryConfigPath, 'utf8'))
  assert.equal(
    saved.project.name,
    'Saved Arbitrary Config App',
    'settings save should write back to the explicit config path'
  )

  const invalidSourceRoot = path.join(arbitraryRoot, 'not-a-directory.ts')
  fs.writeFileSync(invalidSourceRoot, 'export const value = 1\n', 'utf8')
  const configBeforeFailedUpdate = fs.readFileSync(arbitraryConfigPath, 'utf8')
  const graphBeforeFailedUpdate = fs.readFileSync(arbitraryGraphPath, 'utf8')
  const failedUpdate = structuredClone(current)
  failedUpdate.project.name = 'Must Roll Back'
  failedUpdate.sourceRoots.frontend = 'not-a-directory.ts'
  const failedUpdateResponse = await request(port, 'POST', '/api/project-map', failedUpdate, session)
  assert.equal(failedUpdateResponse.status, 500, 'a scan failure must reject the project-map update')
  assert.equal(JSON.parse(failedUpdateResponse.body).error, 'Internal server error.')
  assert.equal(
    fs.readFileSync(arbitraryConfigPath, 'utf8'),
    configBeforeFailedUpdate,
    'a failed update must restore the exact previous project-map document'
  )
  assert.equal(
    fs.readFileSync(arbitraryGraphPath, 'utf8'),
    graphBeforeFailedUpdate,
    'a failed update must preserve the previous graph'
  )
  const activeAfterRollback = JSON.parse((await request(port, 'GET', '/project-map.json')).body)
  assert.equal(
    activeAfterRollback.project.name,
    'Saved Arbitrary Config App',
    'a failed update must restore the active project map'
  )

  const malformedResponse = await requestRaw(port, 'POST', '/api/project-map', '{ not json', session)
  assert.equal(malformedResponse.status, 400, 'malformed project-map JSON must return a controlled client error')
  assert.deepEqual(JSON.parse(malformedResponse.body), { ok: false, error: 'Request body must contain valid JSON.' })
  const malformedTraceResponse = await requestRaw(port, 'POST', '/api/submaps/from-trace', '{ not json', session)
  assert.equal(malformedTraceResponse.status, 400, 'malformed trace JSON must return a controlled client error')
  assert.deepEqual(JSON.parse(malformedTraceResponse.body), {
    ok: false,
    error: 'Request body must contain valid JSON.'
  })
  const scalarConfigResponse = await requestRaw(port, 'POST', '/api/project-map', 'null', session)
  assert.equal(scalarConfigResponse.status, 400, 'a project map must be a JSON object')
  assert.match(JSON.parse(scalarConfigResponse.body).error, /Project map must be a JSON object/u)
  const arrayTraceResponse = await requestRaw(port, 'POST', '/api/submaps/from-trace', '[]', session)
  assert.equal(arrayTraceResponse.status, 400, 'a trace request must be a JSON object')
  assert.equal(JSON.parse(arrayTraceResponse.body).error, 'Trace request must be a JSON object.')
  const invalidTraceShape = await request(
    port,
    'POST',
    '/api/submaps/from-trace',
    { id: 42, nodeIds: [traceNodeId], unexpected: true },
    session
  )
  assert.equal(invalidTraceShape.status, 400, 'unknown trace fields and invalid scalar types must be rejected')
  assert.match(JSON.parse(invalidTraceShape.body).error, /Unknown trace request properties: unexpected/u)

  const malformedRuntimeLinksPath = path.join(arbitraryConfigDir, 'malformed-runtime-links.json')
  fs.writeFileSync(malformedRuntimeLinksPath, '{ internal parser detail', 'utf8')
  const malformedRuntimeConfig = structuredClone(current)
  malformedRuntimeConfig.project.runtimeLinks = 'code-map/malformed-runtime-links.json'
  const configBeforeInternalSyntaxError = fs.readFileSync(arbitraryConfigPath, 'utf8')
  const internalSyntaxResponse = await request(port, 'POST', '/api/project-map', malformedRuntimeConfig, session)
  assert.equal(
    internalSyntaxResponse.status,
    500,
    'internal JSON parsing failures must not be classified as client input errors'
  )
  assert.deepEqual(JSON.parse(internalSyntaxResponse.body), { ok: false, error: 'Internal server error.' })
  assert.equal(
    fs.readFileSync(arbitraryConfigPath, 'utf8'),
    configBeforeInternalSyntaxError,
    'internal parsing failures must roll back config updates'
  )

  const configBeforeInvalidSave = fs.readFileSync(arbitraryConfigPath, 'utf8')
  const invalidConfigResponse = await request(
    port,
    'POST',
    '/api/project-map',
    {
      schemaVersion: 1,
      project: {},
      sourceRoots: {}
    },
    session
  )
  assert.equal(invalidConfigResponse.status, 400, 'invalid project-map documents must be rejected before persistence')
  assert.match(JSON.parse(invalidConfigResponse.body).error, /project\.name is required/u)
  assert.equal(
    fs.readFileSync(arbitraryConfigPath, 'utf8'),
    configBeforeInvalidSave,
    'an invalid save must preserve the last valid config'
  )

  for (const [field, mutate] of [
    [
      'graph output',
      (document) => {
        document.project.graphOutput = '../escaped-graph.json'
      }
    ],
    [
      'submap directory',
      (document) => {
        document.project.submapsDirectory = '../escaped-submaps'
      }
    ],
    [
      'frontend source root',
      (document) => {
        document.sourceRoots.frontend = '../outside-source'
      }
    ],
    [
      'symlinked source root',
      (document) => {
        document.sourceRoots.frontend = 'linked-outside'
      }
    ],
    [
      'runtime links',
      (document) => {
        document.project.runtimeLinks = '../outside-runtime-links.json'
      }
    ],
    [
      'import alias',
      (document) => {
        document.imports = { aliases: [{ prefix: '@outside/', path: '../outside-source' }] }
      }
    ],
    [
      'template plugin',
      (document) => {
        document.templates.plugins = ['../../../outside-plugin.mjs']
      }
    ]
  ]) {
    const escapedConfig = structuredClone(current)
    mutate(escapedConfig)
    const configBeforeEscape = fs.readFileSync(arbitraryConfigPath, 'utf8')
    const escapedResponse = await request(port, 'POST', '/api/project-map', escapedConfig, session)
    assert.equal(escapedResponse.status, 400, `${field} must not escape the project root`)
    assert.match(JSON.parse(escapedResponse.body).error, /must resolve within the project root/u)
    assert.equal(
      fs.readFileSync(arbitraryConfigPath, 'utf8'),
      configBeforeEscape,
      `a rejected ${field} must not modify the config`
    )
  }
  assert.equal(
    fs.existsSync(path.join(tempRoot, 'escaped-graph.json')),
    false,
    'rejected graph paths must not create files outside the project'
  )
  const changedPluginConfig = structuredClone(current)
  changedPluginConfig.templates.plugins = ['./templates/another-plugin.mjs']
  const configBeforePluginChange = fs.readFileSync(arbitraryConfigPath, 'utf8')
  const changedPluginResponse = await request(port, 'POST', '/api/project-map', changedPluginConfig, session)
  assert.equal(changedPluginResponse.status, 400, 'the viewer must not change the trusted plugin list')
  assert.match(JSON.parse(changedPluginResponse.body).error, /Template plugins cannot be changed from the viewer/u)
  assert.equal(
    fs.readFileSync(arbitraryConfigPath, 'utf8'),
    configBeforePluginChange,
    'a rejected plugin change must preserve the config'
  )

  const notFound = await request(port, 'GET', '/missing', null)
  assert.equal(notFound.status, 404)

  const graphBackup = fs.readFileSync(arbitraryGraphPath, 'utf8')
  fs.rmSync(arbitraryGraphPath)
  fs.mkdirSync(arbitraryGraphPath)
  try {
    const failedScan = await request(port, 'POST', '/api/scan', {}, session)
    assert.equal(failedScan.status, 500, 'graph write failures must be returned as controlled scan errors')
    assert.equal(JSON.parse(failedScan.body).ok, false)
    assert.equal(
      JSON.parse(failedScan.body).error,
      'Internal server error.',
      'internal scan details must not leak over HTTP'
    )
    assert.equal(
      fs.readdirSync(arbitraryConfigDir).some((name) => name.endsWith('.tmp')),
      false,
      'failed graph writes must clean up temporary files'
    )
  } finally {
    fs.rmSync(arbitraryGraphPath, { recursive: true })
    fs.writeFileSync(arbitraryGraphPath, graphBackup, 'utf8')
  }

  const configBackup = fs.readFileSync(arbitraryConfigPath, 'utf8')
  fs.rmSync(arbitraryConfigPath)
  fs.mkdirSync(arbitraryConfigPath)
  try {
    const failedSave = await request(port, 'POST', '/api/project-map', current, session)
    assert.equal(failedSave.status, 500, 'config write failures must be returned as controlled save errors')
    assert.equal(JSON.parse(failedSave.body).ok, false)
    assert.equal(
      JSON.parse(failedSave.body).error,
      'Internal server error.',
      'internal save details must not leak over HTTP'
    )
    assert.equal(
      fs.readdirSync(arbitraryConfigDir).some((name) => name.endsWith('.tmp')),
      false,
      'failed config writes must clean up temporary files'
    )
  } finally {
    fs.rmSync(arbitraryConfigPath, { recursive: true })
    fs.writeFileSync(arbitraryConfigPath, configBackup, 'utf8')
  }
})

await withServer([], appRoot, async (port, session) => {
  const current = JSON.parse((await request(port, 'GET', '/project-map.json')).body)
  const response = await request(port, 'POST', '/api/project-map', current, session)
  assert.equal(response.status, 400, 'settings save should be blocked for auto-detected configs')
  assert.match(response.body, /Cannot save an auto-detected project map/u)
})

console.log('cli smoke tests passed')
