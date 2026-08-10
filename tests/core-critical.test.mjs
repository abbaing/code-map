import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Graph, validateGraphDocument } from '#core/graph.mjs'
import { createProjectContext, loadProjectContext, normalizeProjectMap, validateProjectMap } from '#core/config.mjs'
import { buildTemplateRegistry, loadTemplatePlugins, registerTemplate } from '#templates/registry.mjs'
import { SubmapError, readJson, writeJsonAtomic } from '#submap/index.mjs'
import { nodePlatform } from '#platform/node.mjs'

const graph = new Graph()
graph.addNode('a', { label: 'A', type: 'service', meta: { first: true } })
graph.addNode('a', { layer: 'application', meta: { second: true } })
graph.addNode('b', { label: 'B' })

assert.deepEqual(
  graph.getNode('a'),
  {
    id: 'a',
    label: 'A',
    type: 'service',
    layer: 'application',
    module: 'shared',
    path: undefined,
    meta: { first: true, second: true }
  },
  'repeated node discoveries must merge metadata without losing classification'
)

graph.addEdge('a', 'b', 'imports', { confidence: 'high', source: 'test', evidence: './dependency.js' })
graph.addEdge('a', 'b', 'imports', { confidence: 'low', source: 'duplicate' })
graph.addEdge('a', 'a', 'imports')
graph.addEdge('a', 'missing', 'imports')
graph.addEdge('', 'b', 'imports')
assert.equal(graph.allEdges().length, 1, 'edges must be unique, non-self-referential, and connect existing nodes')
assert.equal(graph.getEdge('a::imports::b').confidence, 'high', 'a duplicate edge must not replace its first evidence')
assert.equal(graph.getEdge('a::imports::b').source, 'test', 'edges must retain their provenance')
assert.equal(graph.getEdge('a::imports::b').evidence, './dependency.js', 'edges must retain their evidence')

const validGraphDocument = {
  version: 1,
  generatedAt: '2030-01-02T03:04:05.000Z',
  stats: { nodes: 2, edges: 1 },
  nodes: graph.allNodes(),
  edges: graph.allEdges()
}
assert.equal(validateGraphDocument(validGraphDocument), validGraphDocument)
assert.throws(() => validateGraphDocument(null), /Graph document must be an object/u)
assert.throws(
  () => validateGraphDocument({ version: 1, generatedAt: '2030-01-02T03:04:05.000Z', stats: {} }),
  (error) =>
    ['nodes must be an array', 'edges must be an array'].every((message) => error.message.includes(message)) &&
    error.issues.length === 2,
  'graph validation must report missing collections together'
)
assert.throws(
  () =>
    validateGraphDocument({
      version: 0,
      generatedAt: 'not-a-date',
      stats: { nodes: 1, edges: -1 },
      nodes: [
        { id: 'a', label: '', type: 'service', layer: 'application', module: 'shared' },
        { id: 'a', label: 'Duplicate', type: 'service', layer: 'application', module: 'shared' }
      ],
      edges: [
        { id: 'wrong', from: 'a', to: 'missing', type: 'imports' },
        { id: 'wrong', from: 'missing', to: 'a', type: '' },
        null
      ]
    }),
  (error) =>
    [
      'version must be a positive integer',
      'generatedAt must be a valid date-time string',
      'stats.nodes must equal 2',
      'stats.edges must be a non-negative integer',
      'nodes[0].label must be a non-empty string',
      'nodes[1].id duplicates node a',
      'edges[0].to references missing node missing',
      'edges[0].id must match its endpoints and type',
      'edges[1].id duplicates edge wrong',
      'edges[1].from references missing node missing',
      'edges[2] must be an object'
    ].every((message) => error.message.includes(message)),
  'graph validation must aggregate identity, count, and topology errors'
)

graph.clear()
assert.deepEqual([graph.allNodes().length, graph.allEdges().length], [0, 0], 'clear must reset both graph indexes')

assert.equal(
  normalizeProjectMap({ project: { name: 'Default Output' }, sourceRoots: { frontend: 'src' } }).project.graphOutput,
  '.code-map/graph.json',
  'normalized configs without an explicit output must default below .code-map'
)

const mutableInput = {
  schemaVersion: 1,
  project: { name: 'Immutable Context', graphOutput: 'graph.json' },
  sourceRoots: { frontend: 'src' },
  modules: { shared: 'shared' }
}
const firstContext = createProjectContext(mutableInput, {
  repoRoot: path.join(os.tmpdir(), 'context-one'),
  configPath: 'config/project-map.json',
  platform: nodePlatform
})
const secondContext = createProjectContext(
  {
    schemaVersion: 1,
    project: { name: 'Independent Context' },
    sourceRoots: { frontend: 'client' },
    modules: { shared: 'common' }
  },
  { repoRoot: path.join(os.tmpdir(), 'context-two'), platform: nodePlatform }
)
mutableInput.project.name = 'Mutated Input'
assert.equal(firstContext.projectMap.project.name, 'Immutable Context', 'contexts must clone their configuration input')
assert.equal(Object.isFrozen(firstContext), true, 'the context boundary must be immutable')
assert.equal(Object.isFrozen(firstContext.projectMap.modules), true, 'nested configuration must be immutable')
assert.throws(
  () => {
    firstContext.projectMap.modules.shared = 'changed'
  },
  TypeError,
  'configuration mutation must fail immediately'
)
assert.equal(secondContext.projectMap.modules.shared, 'common', 'contexts must not share configuration state')
assert.equal(
  firstContext.resolveGraphOutputPath(),
  path.join(os.tmpdir(), 'context-one', 'config', 'graph.json'),
  'bare graph outputs must resolve beside an explicit project map'
)
assert.equal(
  secondContext.resolveRepoPath('client/index.ts'),
  path.join(os.tmpdir(), 'context-two', 'client', 'index.ts'),
  'repository paths must resolve against their own context root'
)

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'code-map-core-'))
try {
  assert.throws(
    () =>
      loadProjectContext(undefined, {
        repoRoot: tempRoot,
        argv: ['code-map'],
        platform: nodePlatform
      }),
    (error) => /No project-map\.json found/u.test(error.message),
    'loading without a config must explain how to provide one'
  )

  const loadedContext = loadProjectContext(
    {
      schemaVersion: 1,
      project: { name: 'Loaded Context' },
      sourceRoots: { frontend: 'src' }
    },
    { repoRoot: tempRoot, platform: nodePlatform }
  )
  assert.equal(loadedContext.repoRoot, tempRoot)

  const malformedPath = path.join(tempRoot, 'malformed.project-map.json')
  fs.writeFileSync(malformedPath, '{ invalid json', 'utf8')
  assert.throws(
    () => loadProjectContext(malformedPath, { repoRoot: tempRoot, platform: nodePlatform }),
    (error) => /Failed to read project map/u.test(error.message) && /JSON/u.test(error.message),
    'malformed JSON must retain config-path context'
  )

  assert.throws(
    () =>
      validateProjectMap({ schemaVersion: '1', project: {}, sourceRoots: {}, layers: [], imports: { aliases: {} } }),
    (error) =>
      [
        'schemaVersion must be an integer',
        'project.name is required',
        'sourceRoots.frontend is required',
        'layers must contain at least one layer',
        'imports.aliases must be an array'
      ].every((message) => error.message.includes(message)),
    'config validation must report all independent schema errors together'
  )
  assert.throws(
    () =>
      validateProjectMap({
        schemaVersion: 0,
        project: { name: 42, graphOutput: '' },
        sourceRoots: { frontend: [], extra: 'outside-contract' },
        templates: { enabled: [''], plugins: 'plugin.mjs' },
        ignoredDirs: 'node_modules',
        imports: { aliases: [null, { prefix: '', path: 1, extra: true }] },
        layers: [null, { id: '', label: 2 }],
        modules: [],
        types: null,
        frontend: 'frontend',
        backend: [],
        rules: { enabled: 'rule', options: [], suppressions: [null, { reason: '', ruleId: 1 }] }
      }),
    (error) =>
      [
        'schemaVersion must be at least 1',
        'project.name must be a non-empty string',
        'project.graphOutput must be a non-empty string',
        'sourceRoots.frontend must be a non-empty string',
        'sourceRoots contains unknown properties: extra',
        'templates.enabled must contain only non-empty strings',
        'templates.plugins must be an array',
        'ignoredDirs must be an array',
        'imports.aliases[0] must be an object',
        'imports.aliases[1].prefix must be a non-empty string',
        'imports.aliases[1].path must be a non-empty string',
        'layers[0] must be an object',
        'layers[1].id must be a non-empty string',
        'rules.enabled must be an array',
        'rules.options must be an object',
        'rules.suppressions[0] must be an object',
        'rules.suppressions[1].reason must be a non-empty string',
        'modules must be an object',
        'types must be an object',
        'frontend must be an object',
        'backend must be an object'
      ].every((message) => error.message.includes(message)),
    'config validation must aggregate nested type and shape errors'
  )

  assert.throws(
    () => buildTemplateRegistry({ templates: { enabled: ['does-not-exist'] } }),
    /Unknown code map template: does-not-exist/u,
    'unknown templates must fail before scanning'
  )
  assert.throws(() => registerTemplate({}), /Template id must be a non-empty string/u)
  await assert.rejects(
    loadTemplatePlugins({ templates: { plugins: ['./missing-plugin.mjs'] } }, path.join(tempRoot, 'project-map.json')),
    /Custom template plugins are disabled by default/u,
    'custom plugins must require explicit trust before module resolution'
  )
  await assert.rejects(
    loadTemplatePlugins({ templates: { plugins: ['./missing-plugin.mjs'] } }, path.join(tempRoot, 'project-map.json'), {
      allow: true
    }),
    (error) => error.code === 'ERR_MODULE_NOT_FOUND',
    'missing template plugins must fail with their import error'
  )

  const ignoredPluginPath = path.join(tempRoot, 'ignored-plugin.mjs')
  fs.writeFileSync(ignoredPluginPath, 'export const notATemplate = { description: "no id" }\n', 'utf8')
  await loadTemplatePlugins(
    { templates: { plugins: ['./ignored-plugin.mjs'] } },
    path.join(tempRoot, 'project-map.json'),
    { allow: true }
  )

  const missingJson = path.join(tempRoot, 'missing.json')
  assert.throws(
    () => readJson(missingJson),
    (error) => error instanceof SubmapError && error.code === 'SUBMAP_FILE_NOT_FOUND' && error.exitCode === 3
  )
  assert.throws(
    () => readJson(malformedPath),
    (error) => error instanceof SubmapError && error.code === 'SUBMAP_INVALID_JSON' && error.exitCode === 2
  )

  const atomicPath = path.join(tempRoot, 'nested', 'document.json')
  assert.equal(writeJsonAtomic(atomicPath, { revision: 1 }), path.resolve(atomicPath))
  assert.deepEqual(JSON.parse(fs.readFileSync(atomicPath, 'utf8')), { revision: 1 })
  assert.throws(
    () => writeJsonAtomic(atomicPath, { revision: 2 }),
    (error) => error instanceof SubmapError && error.code === 'SUBMAP_OUTPUT_EXISTS'
  )
  writeJsonAtomic(atomicPath, { revision: 2 }, { force: true })
  assert.deepEqual(
    JSON.parse(fs.readFileSync(atomicPath, 'utf8')),
    { revision: 2 },
    'force writes must replace existing JSON'
  )
  const cyclicDocument = {}
  cyclicDocument.self = cyclicDocument
  assert.throws(() => writeJsonAtomic(atomicPath, cyclicDocument, { force: true }), /circular structure/iu)
  assert.deepEqual(
    JSON.parse(fs.readFileSync(atomicPath, 'utf8')),
    { revision: 2 },
    'serialization failures must preserve the previous document'
  )
  assert.deepEqual(
    fs.readdirSync(path.dirname(atomicPath)),
    ['document.json'],
    'atomic writes must not leave temporary files behind'
  )
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true })
}

console.log('core critical tests passed')
