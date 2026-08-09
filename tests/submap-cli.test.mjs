import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertCommand } from '#core/command-registry.mjs'
import { submapCommands } from '#submap/cli.mjs'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cliPath = path.join(packageRoot, 'cli.mjs')
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'code-map-submap-cli-'))
const graphPath = path.join(tempRoot, 'graph.json')
const submapsDir = path.join(tempRoot, 'submaps')
const configPath = path.join(tempRoot, 'project-map.json')
const graph = {
  version: 1,
  generatedAt: '2026-08-05T00:00:00.000Z',
  projectMap: { project: { name: 'CLI Fixture' } },
  nodes: [
    { id: 'a', label: 'A', type: 'service', layer: 'application', module: 'demo', path: 'src/a.ts', meta: {} },
    { id: 'b', label: 'B', type: 'repository', layer: 'infrastructure', module: 'demo', path: 'src/b.ts', meta: {} }
  ],
  edges: [
    {
      id: 'a::imports::b',
      from: 'a',
      to: 'b',
      type: 'imports',
      label: 'imports',
      confidence: 'high',
      source: 'fixture'
    }
  ],
  findings: [],
  orphans: []
}
assert.deepEqual(
  submapCommands.map((command) => assertCommand(command).id),
  ['submap.help', 'submap.create', 'submap.inspect', 'submap.validate', 'submap.diff', 'submap.list', 'submap.unknown']
)
fs.writeFileSync(graphPath, `${JSON.stringify(graph, null, 2)}\n`, 'utf8')
fs.mkdirSync(path.join(tempRoot, 'src'))
fs.writeFileSync(
  configPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      project: { name: 'CLI Fixture', graphOutput: 'graph.json', submapsDirectory: 'configured-submaps' },
      sourceRoots: { frontend: 'src' }
    },
    null,
    2
  )}\n`,
  'utf8'
)

const stdoutCreate = run([
  'submap',
  'create',
  'cli-demo',
  '--graph',
  graphPath,
  '--node',
  'a',
  '--depth',
  '1',
  '--stdout',
  '--quiet'
])
assert.equal(stdoutCreate.status, 0, stdoutCreate.stderr)
assert.equal(stdoutCreate.stderr, '', 'quiet stdout mode must not emit diagnostics')
const stdoutSubmap = JSON.parse(stdoutCreate.stdout)
assert.equal(stdoutSubmap.kind, 'code-map/submap')
assert.deepEqual(
  stdoutSubmap.nodes.map((node) => node.id),
  ['a', 'b']
)

const fileCreate = run(['submap', 'create', 'stored-demo', '--graph', graphPath, '--node', 'a', '--dir', submapsDir])
assert.equal(fileCreate.status, 0, fileCreate.stderr)
const files = fs.readdirSync(submapsDir).filter((name) => name.endsWith('.submap.json'))
assert.equal(files.length, 1)
const submapPath = path.join(submapsDir, files[0])

const inspect = run(['submap', 'inspect', submapPath, '--json'])
assert.equal(inspect.status, 0, inspect.stderr)
assert.equal(JSON.parse(inspect.stdout).id, 'stored-demo')

const validate = run(['submap', 'validate', submapPath, '--against', graphPath, '--json'])
assert.equal(validate.status, 0, validate.stderr)
assert.equal(JSON.parse(validate.stdout).valid, true)

const list = run(['submap', 'list', '--dir', submapsDir, '--json'])
assert.equal(list.status, 0, list.stderr)
assert.equal(JSON.parse(list.stdout).length, 1)

const configuredCreate = run(['submap', 'create', 'configured-demo', '--config', configPath, '--node', 'a', '--quiet'])
assert.equal(configuredCreate.status, 0, configuredCreate.stderr)
assert.equal(
  fs.readdirSync(path.join(tempRoot, 'configured-submaps')).some((name) => name.startsWith('configured-demo@')),
  true
)

const duplicateOutput = run([
  'submap',
  'create',
  'stored-demo',
  '--graph',
  graphPath,
  '--node',
  'a',
  '--output',
  submapPath,
  '--json-errors'
])
assert.equal(duplicateOutput.status, 6)
assert.equal(JSON.parse(duplicateOutput.stderr).error.code, 'SUBMAP_OUTPUT_EXISTS')

const spec = {
  id: 'stdin-demo',
  selectors: { nodeIds: ['a'] },
  traversal: { direction: 'outgoing', maxDepth: 0 }
}
const stdinCreate = run(
  ['submap', 'create', '--graph', graphPath, '--spec', '-', '--stdout', '--quiet'],
  JSON.stringify(spec)
)
assert.equal(stdinCreate.status, 0, stdinCreate.stderr)
assert.equal(JSON.parse(stdinCreate.stdout).id, 'stdin-demo')

const missing = run(['submap', 'create', 'bad', '--graph', graphPath, '--node', 'missing', '--stdout', '--json-errors'])
assert.equal(missing.status, 3)
assert.equal(JSON.parse(missing.stderr).error.code, 'SUBMAP_SEED_NOT_FOUND')
assert.equal(missing.stdout, '')

fs.rmSync(tempRoot, { recursive: true, force: true })
console.log('submap CLI tests passed')

function run(args, input) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: tempRoot,
    encoding: 'utf8',
    input,
    env: { ...process.env, CODE_MAP_CONFIG: '' }
  })
}
