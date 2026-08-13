import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadProjectContext, validateProjectMap } from '#core/config.mjs'
import { buildTemplateRegistry, loadTemplatePlugins, registerTemplate } from '#templates/registry.mjs'
import { SubmapError, readJson, writeJsonAtomic } from '#submap/index.mjs'
import { nodePlatform } from '#platform/node.mjs'

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
        'Only project map schema version 1 is supported',
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
    () =>
      validateProjectMap({
        schemaVersion: 2,
        project: { name: 'Future project map' },
        sourceRoots: { frontend: 'src' }
      }),
    /Only project map schema version 1 is supported/u,
    'future project map versions must require an explicit migration'
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

console.log('core IO and plugin tests passed')
