#!/usr/bin/env node
import { createCliCommands } from './cli-commands.mjs'
import { createCommandRegistry } from './command-registry.mjs'
import { nodePlatform } from './platform/node.mjs'
import { nodeSubmapRepository } from './submap/io.mjs'
import { nodeSubmapCliCapabilities } from './submap/cli-node.mjs'

const { environment } = nodePlatform
const registry = createCommandRegistry(
  createCliCommands({
    platform: nodePlatform,
    repository: nodeSubmapRepository,
    output: console,
    submapCli: nodeSubmapCliCapabilities
  })
)
const result = await registry.execute({
  args: environment.args().slice(2),
  repoRoot: environment.cwd()
})
if (result.exitCode !== null) {
  environment.exit(result.exitCode)
}
