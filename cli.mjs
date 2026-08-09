#!/usr/bin/env node
import { createCliCommands } from '#app/cli-commands.mjs'
import { createCommandRegistry } from '#core/command-registry.mjs'
import { detect, detectSummary } from '#node/detect-node.mjs'
import { nodePlatform } from '#platform/node.mjs'
import { nodeTextWriter } from '#node/json-io.mjs'
import { writeGraph } from '#app/scan.mjs'
import { nodeSubmapRepository } from '#submap/io.mjs'
import { nodeSubmapCliCapabilities } from '#submap/cli-node.mjs'
import { buildTemplateRegistry, listTemplates, loadTemplatePlugins } from '#templates/registry.mjs'

const { environment } = nodePlatform
const registry = createCommandRegistry(
  createCliCommands({
    platform: nodePlatform,
    writer: nodeTextWriter,
    repository: nodeSubmapRepository,
    output: console,
    detector: Object.freeze({ detect, summarize: detectSummary }),
    scanner: Object.freeze({
      scan(outputPath, projectContext) {
        return writeGraph(outputPath, projectContext, {
          registry: buildTemplateRegistry(projectContext.projectMap),
          writer: nodeTextWriter
        })
      }
    }),
    templates: Object.freeze({ list: listTemplates, load: loadTemplatePlugins }),
    viewerServer: Object.freeze({
      async start(options) {
        const { startServer } = await import('#entry/server.mjs')
        return startServer(options)
      }
    }),
    submapCli: Object.freeze({
      ...nodeSubmapCliCapabilities,
      async run(args, options) {
        const { runSubmapCli } = await import('#submap/cli.mjs')
        return runSubmapCli(args, options)
      }
    })
  })
)
const result = await registry.execute({
  args: environment.args().slice(2),
  repoRoot: environment.cwd()
})
if (result.exitCode !== null) {
  environment.exit(result.exitCode)
}
