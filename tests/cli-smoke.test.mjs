import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startServer } from '#entry/server.mjs'
import {
  appRoot,
  arbitraryConfigPath,
  arbitraryGraphPath,
  arbitraryRoot,
  cliPath,
  tempRoot
} from '#tests/cli-test-workspace.mjs'

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
assert.match(help, /Usage:\s+code-map\s+Scan once and serve viewer/u)
assert.doesNotMatch(help, /tools\/code-map\/cli\.mjs/u)
assert.match(help, /CODE_MAP_HOST\s+Viewer server host \(default: 127\.0\.0\.1\)/u)
assert.match(help, /--allow-plugins\s+Trust and execute configured plugin modules/u)

const templates = run(['--templates'])
assert.match(templates, /^base\s+core/mu)
assert.match(templates, /^typescript\s+technology/mu)

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
  application: {
    graphPath: () => arbitraryGraphPath,
    projectMap: () => arbitraryGraph.projectMap,
    scan: () => arbitraryGraph,
    saveProjectMap: () => ({ projectMap: arbitraryGraph.projectMap, stats: arbitraryGraph.stats }),
    createTraceSubmap: () => ({ file: '', uid: '', statistics: {} })
  },
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

if (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('cli command smoke tests passed')
}
