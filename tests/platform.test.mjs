import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadProjectContext } from '#core/config.mjs'
import { assertPlatform, platformContract } from '#platform/contracts.mjs'
import { createNodePlatform, nodePlatform } from '#platform/node.mjs'
import { createSubmap } from '#submap/create.mjs'

assert.deepEqual(platformContract.clock, ['nowIso', 'nowMilliseconds'])
assert.throws(
  () => assertPlatform({}),
  /Platform capability fileSystem is required/u,
  'incomplete platform implementations must fail at the boundary'
)

const exitSignal = new Error('exit')
const testProcess = {
  cwd: () => 'C:\\virtual-project',
  argv: ['node', 'code-map', '--scan'],
  env: { CODE_MAP_PORT: '4400' },
  exit(code) {
    exitSignal.code = code
    throw exitSignal
  }
}
const isolatedNodePlatform = createNodePlatform({ processRef: testProcess })
assert.equal(isolatedNodePlatform.environment.cwd(), testProcess.cwd())
assert.deepEqual(isolatedNodePlatform.environment.args(), testProcess.argv)
assert.notEqual(isolatedNodePlatform.environment.args(), testProcess.argv, 'argument arrays must be copied')
assert.equal(isolatedNodePlatform.environment.variable('CODE_MAP_PORT'), '4400')
assert.throws(
  () => isolatedNodePlatform.environment.exit(7),
  (error) => error === exitSignal && error.code === 7
)
assert.equal(
  isolatedNodePlatform.hash.sha256('abc'),
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
)
assert.match(isolatedNodePlatform.random.uuid(), /^[0-9a-f-]{36}$/u)
assert.match(isolatedNodePlatform.random.token(16), /^[A-Za-z0-9_-]{22}$/u)
assert.equal(Number.isFinite(isolatedNodePlatform.clock.nowMilliseconds()), true)
assert.equal(Number.isNaN(Date.parse(isolatedNodePlatform.clock.nowIso())), false)

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'code-map-platform-'))
try {
  const configPath = path.join(tempRoot, 'project-map.json')
  const projectDocument = {
    schemaVersion: 1,
    project: { name: 'Virtual Project' },
    sourceRoots: { frontend: 'src' }
  }
  let requestedPath
  const fileSystem = Object.freeze({
    ...nodePlatform.fileSystem,
    readText(filePath) {
      requestedPath = filePath
      return JSON.stringify(projectDocument)
    }
  })
  const clock = Object.freeze({ nowIso: () => '2030-01-02T03:04:05.000Z', nowMilliseconds: () => 1_893_554_645_000 })
  const hash = Object.freeze({ sha256: () => 'controlled-digest' })
  const platform = assertPlatform(Object.freeze({ ...nodePlatform, fileSystem, clock, hash }))
  const context = loadProjectContext(configPath, { repoRoot: tempRoot, platform })
  assert.equal(requestedPath, configPath, 'configuration loading must use the injected filesystem')
  assert.equal(context.platform, platform)

  const graph = {
    version: 1,
    generatedAt: clock.nowIso(),
    projectMap: context.projectMap,
    nodes: [{ id: 'a', label: 'A', type: 'service', layer: 'application', module: 'shared' }],
    edges: []
  }
  const submap = createSubmap(graph, { id: 'controlled', selectors: { nodeIds: ['a'] } }, { clock, hash })
  assert.equal(submap.createdAt, clock.nowIso())
  assert.equal(submap.source.graphDigest, 'sha256:controlled-digest')
  assert.equal(submap.uid, 'sha256:controlled-digest')
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true })
}

console.log('platform contract tests passed')
