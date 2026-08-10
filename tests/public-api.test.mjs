import assert from 'node:assert/strict'
import fs from 'node:fs'

const packageDocument = JSON.parse(fs.readFileSync(new URL(import.meta.resolve('#entry/package.json')), 'utf8'))
assert.deepEqual(Object.keys(packageDocument.exports), [
  '.',
  './submap',
  './schemas/graph',
  './schemas/project-map',
  './schemas/submap',
  './schemas/submap-request'
])
const graphSchema = JSON.parse(fs.readFileSync(new URL(import.meta.resolve('@abbaing/code-map/schemas/graph')), 'utf8'))
const projectMapSchema = JSON.parse(
  fs.readFileSync(new URL(import.meta.resolve('@abbaing/code-map/schemas/project-map')), 'utf8')
)
assert.equal(graphSchema.properties.version.const, 1)
assert.equal(projectMapSchema.properties.schemaVersion.const, 1)
for (const developmentDirectory of ['architecture/', 'tests/']) {
  assert.equal(
    packageDocument.files.includes(developmentDirectory),
    false,
    `${developmentDirectory} must not be included in the published package`
  )
}

const rootApi = await import('@abbaing/code-map')
for (const name of [
  'Graph',
  'createDefaultScanPipeline',
  'createNodePlatform',
  'createProjectContext',
  'createScanPipeline',
  'createSubmap',
  'defineScanPhase',
  'loadProjectContext',
  'validateGraphDocument',
  'validateSubmap',
  'writeGraph'
]) {
  assert.equal(typeof rootApi[name], 'function', `root package export ${name} must resolve`)
}

const submapApi = await import('@abbaing/code-map/submap')
assert.equal(typeof submapApi.createSubmap, 'function')
assert.equal(typeof submapApi.validateSubmap, 'function')

for (const specifier of [
  '@abbaing/code-map/graph.mjs',
  '@abbaing/code-map/server.mjs',
  '@abbaing/code-map/tests/submap.test.mjs',
  '@abbaing/code-map/viewer/viewer-init.js'
]) {
  await assert.rejects(
    import(specifier),
    (error) => error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
    `${specifier} must remain internal`
  )
}

console.log('public package contract tests passed')
