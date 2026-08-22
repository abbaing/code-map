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
  const revision = services.submaps.create(graph, {
    id: submap.id,
    revision: 2,
    parentUid: submap.uid,
    selectors: { nodeIds: [graph.nodes[0].id] }
  })
  services.submaps.write(path.join(directory, services.submaps.filename(revision)), revision)
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
  assert.equal(
    listed.some(({ uid }) => uid === submap.uid),
    true
  )
  assert.equal(operations.getSubmap(submap.uid).uid, submap.uid)

  let removalCount = 0
  const rollbackOperations = createServerSubmapOperations({
    state: {
      context: { projectMap: { project: { submapsDirectory: 'submaps' } } }
    },
    paths: createProjectPathPolicy(root, nodePlatform.fileSystem),
    services: {
      ...services,
      submaps: {
        ...services.submaps,
        remove(filePath) {
          removalCount += 1
          if (removalCount === 2) {
            throw new Error('controlled removal failure')
          }
          return services.submaps.remove(filePath)
        }
      }
    },
    fileSystem: nodePlatform.fileSystem,
    root
  })
  assert.throws(() => rollbackOperations.deleteSubmap(submap.uid), /controlled removal failure/u)
  assert.equal(
    operations.listSubmaps().filter(({ id }) => id === submap.id).length,
    2,
    'a failed history deletion must restore revisions already removed'
  )
  assert.deepEqual(operations.deleteSubmap(submap.uid), { id: submap.id, deleted: 2 })
  assert.equal(
    operations.listSubmaps().some(({ id }) => id === submap.id),
    false
  )
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}

console.log('server submap recovery tests passed')
