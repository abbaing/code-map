import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Graph } from '../graph.mjs'
import { loadProjectMap, normalizeProjectMap, validateProjectMap } from '../config.mjs'
import { buildTemplateRegistry, loadTemplatePlugins, registerTemplate } from '../templates/registry.mjs'
import { SubmapError, readJson, writeJsonAtomic } from '../submap/index.mjs'

const graph = new Graph()
graph.addNode('a', { label: 'A', type: 'service', meta: { first: true } })
graph.addNode('a', { layer: 'application', meta: { second: true } })
graph.addNode('b', { label: 'B' })

assert.deepEqual(graph.getNode('a'), {
  id: 'a', label: 'A', type: 'service', layer: 'application', module: 'shared', path: undefined,
  meta: { first: true, second: true }
}, 'repeated node discoveries must merge metadata without losing classification')

graph.addEdge('a', 'b', 'imports', { confidence: 'high', source: 'test' })
graph.addEdge('a', 'b', 'imports', { confidence: 'low', source: 'duplicate' })
graph.addEdge('a', 'a', 'imports')
graph.addEdge('a', 'missing', 'imports')
graph.addEdge('', 'b', 'imports')
assert.equal(graph.allEdges().length, 1, 'edges must be unique, non-self-referential, and connect existing nodes')
assert.equal(graph.getEdge('a::imports::b').confidence, 'high', 'a duplicate edge must not replace its first evidence')

graph.clear()
assert.deepEqual([graph.allNodes().length, graph.allEdges().length], [0, 0], 'clear must reset both graph indexes')

assert.equal(
  normalizeProjectMap({ project: { name: 'Default Output' }, sourceRoots: { frontend: 'src' } }).project.graphOutput,
  '.code-map/graph.json',
  'normalized configs without an explicit output must default below .code-map'
)

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'code-map-core-'))
try {
  assert.throws(
    () => loadProjectMap(),
    error => /No project-map\.json found/u.test(error.message),
    'loading without a config must explain how to provide one'
  )

  const malformedPath = path.join(tempRoot, 'malformed.project-map.json')
  fs.writeFileSync(malformedPath, '{ invalid json', 'utf8')
  assert.throws(
    () => loadProjectMap(malformedPath),
    error => /Failed to read project map/u.test(error.message) && /JSON/u.test(error.message),
    'malformed JSON must retain config-path context'
  )

  assert.throws(
    () => validateProjectMap({ schemaVersion: '1', project: {}, sourceRoots: {}, layers: [], imports: { aliases: {} } }),
    error => [
      'schemaVersion must be an integer', 'project.name is required', 'sourceRoots.frontend is required',
      'layers must contain at least one layer', 'imports.aliases must be an array'
    ].every(message => error.message.includes(message)),
    'config validation must report all independent schema errors together'
  )

  assert.throws(
    () => buildTemplateRegistry({ templates: { enabled: ['does-not-exist'] } }),
    /Unknown code map template: does-not-exist/u,
    'unknown templates must fail before scanning'
  )
  assert.throws(() => registerTemplate({}), /Template id is required/u)
  await assert.rejects(
    loadTemplatePlugins({ templates: { plugins: ['./missing-plugin.mjs'] } }, path.join(tempRoot, 'project-map.json')),
    error => error.code === 'ERR_MODULE_NOT_FOUND',
    'missing template plugins must fail with their import error'
  )

  const ignoredPluginPath = path.join(tempRoot, 'ignored-plugin.mjs')
  fs.writeFileSync(ignoredPluginPath, 'export const notATemplate = { description: "no id" }\n', 'utf8')
  await loadTemplatePlugins({ templates: { plugins: ['./ignored-plugin.mjs'] } }, path.join(tempRoot, 'project-map.json'))

  const missingJson = path.join(tempRoot, 'missing.json')
  assert.throws(
    () => readJson(missingJson),
    error => error instanceof SubmapError && error.code === 'SUBMAP_FILE_NOT_FOUND' && error.exitCode === 3
  )
  assert.throws(
    () => readJson(malformedPath),
    error => error instanceof SubmapError && error.code === 'SUBMAP_INVALID_JSON' && error.exitCode === 2
  )

  const atomicPath = path.join(tempRoot, 'nested', 'document.json')
  assert.equal(writeJsonAtomic(atomicPath, { revision: 1 }), path.resolve(atomicPath))
  assert.deepEqual(JSON.parse(fs.readFileSync(atomicPath, 'utf8')), { revision: 1 })
  assert.throws(
    () => writeJsonAtomic(atomicPath, { revision: 2 }),
    error => error instanceof SubmapError && error.code === 'SUBMAP_OUTPUT_EXISTS'
  )
  writeJsonAtomic(atomicPath, { revision: 2 }, { force: true })
  assert.deepEqual(JSON.parse(fs.readFileSync(atomicPath, 'utf8')), { revision: 2 }, 'force writes must replace existing JSON')
  const cyclicDocument = {}
  cyclicDocument.self = cyclicDocument
  assert.throws(() => writeJsonAtomic(atomicPath, cyclicDocument, { force: true }), /circular structure/iu)
  assert.deepEqual(JSON.parse(fs.readFileSync(atomicPath, 'utf8')), { revision: 2 }, 'serialization failures must preserve the previous document')
  assert.deepEqual(fs.readdirSync(path.dirname(atomicPath)), ['document.json'], 'atomic writes must not leave temporary files behind')
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true })
}

console.log('core critical tests passed')
