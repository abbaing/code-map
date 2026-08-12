import { defineCommand } from '#core/command-registry.mjs'
import { assertCliDependencies } from '#app/cli-contracts.mjs'
import { createCliHandlers } from '#app/cli-handlers.mjs'

export function createCliCommands(dependencies) {
  const handlers = createCliHandlers(assertCliDependencies(dependencies))
  return Object.freeze([
    defineCommand({ id: 'submap', matches: ({ args }) => args[0] === 'submap', execute: handlers.runSubmap }),
    defineCommand({
      id: 'help',
      matches: ({ args }) => args.includes('--help') || args.includes('-h'),
      execute: handlers.showHelp
    }),
    defineCommand({
      id: 'templates',
      matches: ({ args }) => args.includes('--templates'),
      execute: handlers.showTemplates
    }),
    defineCommand({ id: 'init', matches: ({ args }) => args.includes('--init'), execute: handlers.initialize }),
    defineCommand({ id: 'scan', matches: ({ args }) => args.includes('--scan'), execute: handlers.scan }),
    defineCommand({ id: 'serve', matches: () => true, execute: handlers.serve })
  ])
}
