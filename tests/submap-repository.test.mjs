import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { nodePlatform } from '#platform/node.mjs'
import { runSubmapCli } from '#submap/cli.mjs'
import { nodeSubmapCliCapabilities } from '#submap/cli-node.mjs'
import {
  SubmapError,
  assertSubmapRepository,
  createSubmap,
  nodeSubmapRepository,
  submapRepositoryContract
} from '#submap/index.mjs'

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'code-map-submap-repository-'))
const memoryRepository = createMemoryRepository()
const submap = createSubmap(
  {
    version: 1,
    generatedAt: '2026-08-09T00:00:00.000Z',
    stats: { nodes: 1, edges: 0 },
    projectMap: { project: { name: 'Repository Fixture' } },
    nodes: [{ id: 'a', label: 'A', type: 'service', layer: 'application', module: 'demo' }],
    edges: []
  },
  { id: 'repository', selectors: { nodeIds: ['a'] }, traversal: { maxDepth: 0 } },
  { createdAt: '2026-08-09T00:00:00.000Z' }
)

assert.deepEqual(submapRepositoryContract, ['read', 'list', 'write'])
exerciseRepositoryContract('node', nodeSubmapRepository, path.join(tempRoot, 'node'))
exerciseRepositoryContract('memory', memoryRepository, path.join(tempRoot, 'memory'))

const listedPath = path.join(tempRoot, 'injected', 'listed.submap.json')
memoryRepository.write(listedPath, submap)
let stdout = ''
const injectedCapabilities = {
  ...nodeSubmapCliCapabilities,
  output: {
    writeStdout: (chunk) => {
      stdout += chunk
    },
    writeStderr: () => {}
  }
}
const exitCode = await runSubmapCli(['list', '--dir', path.dirname(listedPath), '--json'], {
  cwd: tempRoot,
  platform: nodePlatform,
  repository: memoryRepository,
  ...injectedCapabilities
})
assert.equal(exitCode, 0)
assert.equal(JSON.parse(stdout)[0].id, submap.id, 'the CLI must consume the injected repository')

await assert.rejects(
  () =>
    runSubmapCli(['list'], {
      platform: nodePlatform,
      repository: {},
      ...nodeSubmapCliCapabilities
    }),
  /must implement read/u
)

fs.rmSync(tempRoot, { recursive: true, force: true })
console.log('submap repository contract tests passed')

function exerciseRepositoryContract(name, repository, directory) {
  assert.equal(assertSubmapRepository(repository), repository)
  const filePath = path.join(directory, `${name}.submap.json`)
  const persistedSubmap = jsonClone(submap)
  assert.deepEqual(repository.list(directory), [])
  assert.equal(repository.write(filePath, submap), path.resolve(filePath))
  assert.deepEqual(repository.read(filePath), persistedSubmap)
  assert.deepEqual(repository.list(directory), [path.resolve(filePath)])
  assert.throws(
    () => repository.write(filePath, submap),
    (error) => error instanceof SubmapError && error.code === 'SUBMAP_OUTPUT_EXISTS'
  )
  assert.equal(repository.write(filePath, { ...submap, revision: 2 }, { force: true }), path.resolve(filePath))
  assert.equal(repository.read(filePath).revision, 2)
}

function createMemoryRepository() {
  const documents = new Map()
  return Object.freeze({
    read(filePath) {
      const resolved = path.resolve(filePath)
      if (!documents.has(resolved)) {
        throw new SubmapError('SUBMAP_FILE_NOT_FOUND', 'Unable to read submap.', { path: resolved }, 3)
      }
      return jsonClone(documents.get(resolved))
    },
    list(directory) {
      const resolved = path.resolve(directory)
      return [...documents.keys()]
        .filter((filePath) => path.dirname(filePath) === resolved && filePath.endsWith('.submap.json'))
        .sort()
    },
    write(filePath, value, options = {}) {
      const resolved = path.resolve(filePath)
      if (documents.has(resolved) && !options.force) {
        throw new SubmapError('SUBMAP_OUTPUT_EXISTS', 'Output file already exists.', { path: resolved }, 6)
      }
      documents.set(resolved, jsonClone(value))
      return resolved
    }
  })
}

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value))
}
