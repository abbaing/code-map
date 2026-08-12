import path from 'node:path'
import { prepareCliProject } from '#app/cli-project.mjs'

export function createCliHandlers(capabilities) {
  return Object.freeze({
    runSubmap: (input) => runSubmap(input, capabilities),
    showHelp: () => showHelp(capabilities.output),
    showTemplates: () => showTemplates(capabilities),
    initialize: (input) => initialize(input, capabilities),
    scan: (input) => scan(input, capabilities),
    serve: (input) => serve(input, capabilities)
  })
}

async function runSubmap({ args, repoRoot }, { submapCli, platform, repository }) {
  const exitCode = await submapCli.run(args.slice(1), {
    cwd: repoRoot,
    platform,
    repository,
    documents: submapCli.documents,
    git: submapCli.git,
    output: submapCli.output
  })
  return { exitCode }
}

function showHelp(output) {
  output.log(helpText)
  return { exitCode: 0 }
}

function showTemplates({ templates, output }) {
  for (const template of templates.list()) {
    output.log(`${template.id}\t${template.stage}\t${template.description}`)
  }
  return { exitCode: 0 }
}

function initialize({ args, repoRoot }, { detector, platform, writer, output }) {
  const summary = detector.summarize(repoRoot, { fileSystem: platform.fileSystem })
  output.log(
    `Detected: ${summary.frontendFramework ?? 'unknown'} frontend, ${summary.backendStack ?? 'none'} backend, ${summary.moduleCount} modules`
  )
  const config = detector.detect(repoRoot, { fileSystem: platform.fileSystem })
  const outIndex = args.indexOf('--out')
  const outDir = outIndex >= 0 ? path.resolve(repoRoot, args[outIndex + 1]) : repoRoot
  const slug = (config.project?.name ?? 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const outFile = path.join(outDir, `${slug}.project-map.json`)
  writer.writeText(outFile, `${JSON.stringify(config, null, 2)}\n`)
  output.log(`Written to ${path.relative(repoRoot, outFile)}`)
  output.log(`Review and adjust the file, then run: npx code-map --config ${path.relative(repoRoot, outFile)}`)
  return { exitCode: 0 }
}

async function scan(input, capabilities) {
  const context = await prepareCliProject(input, capabilities)
  if (!context) {
    return { exitCode: 1 }
  }
  const outIndex = input.args.indexOf('--out')
  const outputPath =
    outIndex >= 0 ? path.resolve(input.repoRoot, input.args[outIndex + 1]) : context.resolveGraphOutputPath()
  const result = capabilities.scanner.scan(outputPath, context)
  const display = path.relative(input.repoRoot, outputPath).replaceAll(path.sep, '/')
  capabilities.output.log(
    `Scan complete: ${result.stats.nodes} nodes, ${result.stats.edges} edges, ${result.stats.findings} findings -> ${display}`
  )
  return { exitCode: 0 }
}

async function serve(input, capabilities) {
  const context = await prepareCliProject(input, capabilities)
  if (!context) {
    return { exitCode: 1 }
  }
  capabilities.scanner.scan(context.resolveGraphOutputPath(), context)
  await capabilities.viewerServer.start({ projectContext: context })
  return { exitCode: null }
}

const helpText = `code-map - architectural graph generator

Usage:
  code-map                          Scan once and serve viewer
  code-map --config <path>          Use explicit project-map.json
  code-map --init                   Detect and write project-map.json, then exit
  code-map --init --out <dir>       Write project-map.json to directory
  code-map --scan                   Scan only, no viewer
  code-map --scan --config <path>   Scan with explicit config, no viewer
  code-map --allow-plugins          Trust and execute configured plugin modules
  code-map --templates              List composable templates
  code-map submap --help            Create and manage portable partial graphs
  code-map --help                   Show this help

Environment variables:
  CODE_MAP_CONFIG   Path to project-map.json (same as --config)
  CODE_MAP_HOST     Viewer server host (default: 127.0.0.1)
  CODE_MAP_PORT     Port for the viewer server (default: 1133)

Config:
  --config may point anywhere in the repo. Plugin paths are resolved relative
  to that project-map.json; a bare graphOutput filename is written beside the config.`
