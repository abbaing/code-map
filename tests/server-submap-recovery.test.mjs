import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createProjectPathPolicy } from '#app/server-input.mjs'
import { createServerSubmapOperations } from '#app/server-submaps.mjs'
import { nodeServerApplicationServices } from '#node/server-app-node.mjs'
import { nodePlatform } from '#platform/node.mjs'
import { fixtureGraph } from '#tests/submap-fixture.mjs'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'code-map-submap-recovery-'))
const directory = path.join(root, 'submaps')
fs.mkdirSync(directory)

try {
  const services = nodeServerApplicationServices
  const graph = fixtureGraph()
  const submap = services.submaps.create(graph, {
    id: 'recoverable',
    selectors: { nodeIds: [graph.nodes[0].id] }
  })
  const validPath = path.join(directory, services.submaps.filename(submap))
  services.submaps.write(validPath, submap)
  fs.writeFileSync(path.join(directory, 'broken.submap.json'), '{ invalid JSON', 'utf8')

  const operations = createServerSubmapOperations({
    state: {
      context: { projectMap: { project: { submapsDirectory: 'submaps' } } }
    },
    paths: createProjectPathPolicy(root, nodePlatform.fileSystem),
    services,
    fileSystem: nodePlatform.fileSystem,
    root
  })
  const listed = operations.listSubmaps()
  const invalid = listed.find(({ status }) => status === 'invalid')
  assert.equal(invalid.file, 'broken.submap.json')
  assert.deepEqual(invalid.issue, {
    code: 'SUBMAP_INVALID_JSON',
    message: 'File does not contain valid JSON.'
  })
  assert.equal(listed.find(({ status }) => status === 'valid').uid, submap.uid)
  assert.equal(operations.getSubmap(submap.uid).uid, submap.uid)
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}

console.log('server submap recovery tests passed')
