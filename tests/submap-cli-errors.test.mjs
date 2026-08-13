import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { nodePlatform } from '#platform/node.mjs'
import { runSubmapCli } from '#submap/cli.mjs'
import { SubmapError } from '#submap/errors.mjs'
import { cliFixtureGraph } from '#tests/submap-cli-fixture.mjs'

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'code-map-submap-errors-'))
const graph = cliFixtureGraph()
const graphPath = path.join(tempRoot, 'graph.json')

try {
  const frozenSpec = Object.freeze({
    selectors: Object.freeze({ nodeIds: Object.freeze(['a']) }),
    traversal: Object.freeze({ maxDepth: 0 })
  })
  const stdinHarness = createHarness({ readStdin: () => frozenSpec })
  const stdinExit = await run(stdinHarness, [
    'create',
    'stdin-frozen',
    '--spec',
    '-',
    '--graph',
    graphPath,
    '--stdout',
    '--quiet'
  ])
  assert.equal(stdinExit, 0)
  assert.equal(stdinHarness.stderr, '')
  assert.equal(JSON.parse(stdinHarness.stdout).id, 'stdin-frozen')
  assert.equal('id' in frozenSpec, false, 'stdin request objects must not be mutated')

  const configDir = path.join(tempRoot, 'config')
  const configPath = path.join(configDir, 'project-map.json')
  const configuredGraphPath = path.join(configDir, 'graph.json')
  fs.mkdirSync(path.join(tempRoot, 'src'), { recursive: true })
  fs.mkdirSync(configDir, { recursive: true })
  fs.writeFileSync(
    configPath,
    `${JSON.stringify({
      schemaVersion: 1,
      project: { name: 'Configured CLI', graphOutput: 'graph.json' },
      sourceRoots: { frontend: 'src' }
    })}\n`,
    'utf8'
  )
  const requestedPaths = []
  const configuredHarness = createHarness({
    read(filePath) {
      requestedPaths.push(filePath)
      return graph
    }
  })
  assert.equal(
    await run(configuredHarness, [
      'create',
      'configured',
      '--config',
      configPath,
      '--node',
      'a',
      '--stdout',
      '--quiet'
    ]),
    0
  )
  assert.deepEqual(requestedPaths, [configuredGraphPath], 'graphOutput must use project context path semantics')

  const stdinFailure = createHarness({
    readStdin() {
      throw new SubmapError('SUBMAP_INVALID_STDIN', 'controlled stdin failure')
    }
  })
  assert.equal(await run(stdinFailure, ['create', '--spec', '-', '--graph', graphPath, '--stdout', '--json-errors']), 2)
  assert.equal(stdinFailure.stdout, '')
  assert.deepEqual(JSON.parse(stdinFailure.stderr), {
    error: { code: 'SUBMAP_INVALID_STDIN', message: 'controlled stdin failure', details: {} }
  })

  const scalarSpec = createHarness({ readStdin: () => null })
  assert.equal(await run(scalarSpec, ['create', '--spec', '-', '--graph', graphPath, '--stdout', '--json-errors']), 2)
  assert.equal(scalarSpec.stdout, '')
  assert.equal(JSON.parse(scalarSpec.stderr).error.code, 'SUBMAP_INVALID_SPEC')

  const gitFailure = createHarness({
    metadata() {
      throw new Error('controlled Git failure')
    }
  })
  assert.equal(
    await run(gitFailure, ['create', 'git-failure', '--graph', graphPath, '--node', 'a', '--stdout', '--json-errors']),
    1
  )
  assert.equal(gitFailure.stdout, '')
  assert.equal(JSON.parse(gitFailure.stderr).error.code, 'SUBMAP_INTERNAL_ERROR')
  assert.match(JSON.parse(gitFailure.stderr).error.message, /controlled Git failure/u)

  const writeFailure = createHarness({
    write() {
      throw new Error('controlled persistence failure')
    }
  })
  assert.equal(
    await run(writeFailure, ['create', 'write-failure', '--graph', graphPath, '--node', 'a', '--json-errors']),
    1
  )
  assert.equal(writeFailure.stdout, '')
  assert.equal(JSON.parse(writeFailure.stderr).error.code, 'SUBMAP_INTERNAL_ERROR')
  assert.match(JSON.parse(writeFailure.stderr).error.message, /controlled persistence failure/u)

  const optionConflict = createHarness()
  assert.equal(
    await run(optionConflict, [
      'create',
      'conflict',
      '--graph',
      graphPath,
      '--node',
      'a',
      '--stdout',
      '--output',
      'out.json',
      '--json-errors'
    ]),
    2
  )
  assert.equal(JSON.parse(optionConflict.stderr).error.code, 'SUBMAP_OUTPUT_CONFLICT')

  const idConflict = createHarness({
    readStdin: () => ({ id: 'from-spec', selectors: { nodeIds: ['a'] } })
  })
  assert.equal(
    await run(idConflict, ['create', 'positional', '--spec', '-', '--graph', graphPath, '--stdout', '--json-errors']),
    2
  )
  assert.equal(JSON.parse(idConflict.stderr).error.code, 'SUBMAP_ID_CONFLICT')

  const invalidStored = createHarness({ storedDocument: {} })
  assert.equal(await run(invalidStored, ['validate', 'invalid.submap.json', '--json']), 4)
  assert.equal(JSON.parse(invalidStored.stdout).valid, false)
  assert.equal(invalidStored.stderr, '')

  const unknownCommand = createHarness()
  assert.equal(await run(unknownCommand, ['unsupported', '--json-errors']), 2)
  assert.equal(JSON.parse(unknownCommand.stderr).error.code, 'SUBMAP_UNKNOWN_COMMAND')
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true })
}

console.log('submap CLI error contract tests passed')

async function run(harness, args) {
  return runSubmapCli(args, {
    cwd: tempRoot,
    platform: nodePlatform,
    repository: harness.repository,
    documents: harness.documents,
    git: harness.git,
    output: harness.output
  })
}

function createHarness(overrides = {}) {
  const harness = {
    stdout: '',
    stderr: '',
    repository: {
      read: () => structuredClone(overrides.storedDocument ?? graph),
      list: () => [],
      write: overrides.write ?? ((filePath) => filePath)
    },
    documents: {
      read: overrides.read ?? (() => structuredClone(graph)),
      readStdin: overrides.readStdin ?? (() => ({}))
    },
    git: { metadata: overrides.metadata ?? (() => undefined) }
  }
  harness.output = {
    writeStdout(value) {
      harness.stdout += value
    },
    writeStderr(value) {
      harness.stderr += value
    }
  }
  return harness
}
