import assert from 'node:assert/strict'
import { createCliCommands } from '../cli-commands.mjs'
import {
  assertCommand,
  assertCommandRegistry,
  commandContract,
  createCommandRegistry,
  defineCommand
} from '../command-registry.mjs'

const calls = []
const selected = defineCommand({
  id: 'selected',
  matches: ({ name }) => name === 'selected',
  async execute(input) {
    assert.equal(Object.isFrozen(input), true)
    calls.push(input.name)
    return { exitCode: 7 }
  }
})
const fallback = defineCommand({ id: 'fallback', matches: () => true, execute: () => ({ exitCode: null }) })
const registry = createCommandRegistry([selected, fallback])

assert.deepEqual(commandContract, ['id', 'matches', 'execute'])
assert.equal(Object.isFrozen(selected), true)
assert.equal(Object.isFrozen(registry), true)
assert.equal(Object.isFrozen(registry.commands), true)
assert.equal(assertCommand(selected), selected)
assert.equal(assertCommandRegistry(registry), registry)
assert.deepEqual(await registry.execute({ name: 'selected' }), { commandId: 'selected', exitCode: 7 })
assert.deepEqual(await registry.execute({ name: 'other' }), { commandId: 'fallback', exitCode: null })
assert.deepEqual(calls, ['selected'])

assert.throws(() => createCommandRegistry([]), /requires at least one command/u)
assert.throws(() => createCommandRegistry([selected, selected]), /Command id must be unique/u)
assert.throws(() => defineCommand({ id: 'invalid', matches: () => true }), /must implement execute/u)
assert.throws(() => assertCommandRegistry({ resolve() {} }), /must implement execute/u)
await assert.rejects(() => registry.execute(null), /Command input must be an object/u)
const invalidResult = createCommandRegistry([
  defineCommand({ id: 'invalid-result', matches: () => true, execute: () => ({ exitCode: 300 }) })
])
await assert.rejects(() => invalidResult.execute({}), /exitCode between 0 and 255/u)

const messages = []
const cliRegistry = createCommandRegistry(
  createCliCommands({
    platform: {
      environment: { args: () => [], variable: () => undefined },
      fileSystem: { exists: () => false }
    },
    repository: { read() {}, list: () => [], write() {} },
    writer: { writeText() {} },
    output: { log: (message) => messages.push(message), error: (message) => messages.push(message) },
    submapCli: {
      documents: { read() {}, readStdin() {} },
      git: { metadata() {} },
      output: { writeStdout() {}, writeStderr() {} }
    }
  })
)
assert.equal(cliRegistry.resolve({ args: ['submap', '--help'] }).id, 'submap')
assert.equal(cliRegistry.resolve({ args: ['--help', '--templates'] }).id, 'help')
assert.equal(cliRegistry.resolve({ args: ['--init', '--scan'] }).id, 'init')
assert.equal(cliRegistry.resolve({ args: [] }).id, 'serve')
assert.deepEqual(await cliRegistry.execute({ args: ['--help'], repoRoot: '.' }), {
  commandId: 'help',
  exitCode: 0
})
assert.match(messages[0], /code-map - architectural graph generator/u)

console.log('command registry contract tests passed')
