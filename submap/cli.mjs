import { createCommandRegistry, defineCommand } from '#core/command-registry.mjs'
import { parseArgs } from '#submap/cli-args.mjs'
import { executeCreate } from '#submap/cli-create.mjs'
import { executeDiff } from '#submap/cli-diff.mjs'
import { executeInspect } from '#submap/cli-inspect.mjs'
import { executeList } from '#submap/cli-list.mjs'
import { reportCliError, validateCliContext, writeHelp } from '#submap/cli-support.mjs'
import { executeValidate } from '#submap/cli-validate.mjs'
import { SubmapError } from '#submap/errors.mjs'

const command = (id, name, execute) =>
  defineCommand({
    id,
    matches: ({ args }) => args[0] === name,
    execute: (input) => ({ exitCode: execute(parseArgs(input.args.slice(1)), input) })
  })

export const submapCommands = Object.freeze([
  defineCommand({ id: 'submap.help', matches: ({ args }) => isHelp(args), execute: executeHelp }),
  command('submap.create', 'create', executeCreate),
  command('submap.inspect', 'inspect', executeInspect),
  command('submap.validate', 'validate', executeValidate),
  command('submap.diff', 'diff', executeDiff),
  command('submap.list', 'list', executeList),
  defineCommand({ id: 'submap.unknown', matches: () => true, execute: executeUnknown })
])

const registry = createCommandRegistry(submapCommands)

export async function runSubmapCli(args, context = {}) {
  const capabilities = validateCliContext(context)
  try {
    const cwd = context.cwd ?? capabilities.platform.environment.cwd()
    const result = await registry.execute({ args, cwd, ...capabilities })
    return result.exitCode
  } catch (error) {
    return reportCliError(error, args.includes('--json-errors'), capabilities.output)
  }
}

function isHelp(args) {
  return !args[0] || args[0] === 'help' || args.includes('--help')
}

function executeHelp({ output }) {
  writeHelp(output)
  return { exitCode: 0 }
}

function executeUnknown({ args }) {
  throw new SubmapError('SUBMAP_UNKNOWN_COMMAND', `Unknown submap command: ${args[0]}`, { command: args[0] })
}
