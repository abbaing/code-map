import path from 'node:path'
import { getConfigPathFromArgs, loadProjectContext } from '#core/config.mjs'
import { defineCommand } from '#core/command-registry.mjs'
import { assertTextWriter } from '#core/writer-contract.mjs'

export function createCliCommands({
  platform,
  repository,
  output,
  submapCli,
  writer,
  detector,
  scanner,
  templates,
  viewerServer
}) {
  assertDependencies({ platform, repository, output, submapCli, writer, detector, scanner, templates, viewerServer })
  return Object.freeze([
    defineCommand({ id: 'submap', matches: ({ args }) => args[0] === 'submap', execute: runSubmap }),
    defineCommand({
      id: 'help',
      matches: ({ args }) => args.includes('--help') || args.includes('-h'),
      execute: showHelp
    }),
    defineCommand({
      id: 'templates',
      matches: ({ args }) => args.includes('--templates'),
      execute: showTemplates
    }),
    defineCommand({ id: 'init', matches: ({ args }) => args.includes('--init'), execute: initialize }),
    defineCommand({ id: 'scan', matches: ({ args }) => args.includes('--scan'), execute: scan }),
    defineCommand({ id: 'serve', matches: () => true, execute: serve })
  ])

  async function runSubmap({ args, repoRoot }) {
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

  function showHelp() {
    output.log(helpText)
    return { exitCode: 0 }
  }

  function showTemplates() {
    for (const template of templates.list()) {
      output.log(`${template.id}\t${template.stage}\t${template.description}`)
    }
    return { exitCode: 0 }
  }

  function initialize({ args, repoRoot }) {
    const summary = detector.summarize(repoRoot, { fileSystem: platform.fileSystem })
    output.log(
      `Detected: ${summary.frontendFramework ?? 'unknown'} frontend, ${summary.backendStack ?? 'none'} backend, ${summary.moduleCount} modules`
    )
    const config = detector.detect(repoRoot, { fileSystem: platform.fileSystem })
    const outIndex = args.indexOf('--out')
    const outDir = outIndex >= 0 ? path.resolve(repoRoot, args[outIndex + 1]) : repoRoot
    const projectSlug = (config.project?.name ?? 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const outFile = path.join(outDir, `${projectSlug}.project-map.json`)
    writer.writeText(outFile, `${JSON.stringify(config, null, 2)}\n`)
    output.log(`Written to ${path.relative(repoRoot, outFile)}`)
    output.log(`Review and adjust the file, then run: npx code-map --config ${path.relative(repoRoot, outFile)}`)
    return { exitCode: 0 }
  }

  async function scan(input) {
    const { args, repoRoot } = input
    const projectContext = await prepareProject(input)
    if (!projectContext) {
      return { exitCode: 1 }
    }
    const outIndex = args.indexOf('--out')
    const outputPath =
      outIndex >= 0 ? path.resolve(repoRoot, args[outIndex + 1]) : projectContext.resolveGraphOutputPath()
    const result = scanner.scan(outputPath, projectContext)
    const displayOutput = path.relative(repoRoot, outputPath).replaceAll(path.sep, '/')
    output.log(
      `Scan complete: ${result.stats.nodes} nodes, ${result.stats.edges} edges, ${result.stats.findings} findings -> ${displayOutput}`
    )
    return { exitCode: 0 }
  }

  async function serve(input) {
    const projectContext = await prepareProject(input)
    if (!projectContext) {
      return { exitCode: 1 }
    }
    scanner.scan(projectContext.resolveGraphOutputPath(), projectContext)
    await viewerServer.start({ projectContext })
    return { exitCode: null }
  }

  async function prepareProject({ args, repoRoot }) {
    const { environment, fileSystem } = platform
    const configIndex = args.indexOf('--config')
    const environmentConfigPath = environment.variable('CODE_MAP_CONFIG')
    const explicitConfigPath =
      configIndex >= 0 && args[configIndex + 1]
        ? path.resolve(repoRoot, args[configIndex + 1])
        : environmentConfigPath
          ? path.resolve(repoRoot, environmentConfigPath)
          : null
    const configPath =
      explicitConfigPath ??
      getConfigPathFromArgs(environment.args(), {
        cwd: repoRoot,
        configPath: environmentConfigPath,
        fileSystem
      })
    let pluginBasePath = configPath
    let projectContext
    if (configPath) {
      if (!fileSystem.exists(configPath)) {
        output.error(`Config file not found: ${configPath}`)
        return null
      }
      projectContext = loadProjectContext(configPath, { repoRoot, platform })
      output.log(`Using config: ${path.relative(repoRoot, configPath)}`)
    } else {
      const summary = detector.summarize(repoRoot, { fileSystem })
      output.log(
        `Auto-detected: ${summary.frontendFramework ?? 'unknown'} + ${summary.backendStack ?? 'none'}, ${summary.moduleCount} modules`
      )
      output.log('Tip: run with --init to generate a project-map.json you can customize.')
      projectContext = loadProjectContext(detector.detect(repoRoot, { fileSystem }), { repoRoot, platform })
      pluginBasePath = path.join(repoRoot, 'project-map.json')
    }
    try {
      await templates.load(projectContext.projectMap, pluginBasePath ?? path.join(repoRoot, 'project-map.json'), {
        allow: args.includes('--allow-plugins')
      })
    } catch (error) {
      output.error(error.message)
      return null
    }
    return projectContext
  }
}

function assertDependencies({
  platform,
  repository,
  output,
  submapCli,
  writer,
  detector,
  scanner,
  templates,
  viewerServer
}) {
  if (!platform?.environment || !platform?.fileSystem) {
    throw new TypeError('CLI commands require platform environment and filesystem capabilities.')
  }
  if (
    !repository ||
    typeof repository.read !== 'function' ||
    typeof repository.list !== 'function' ||
    typeof repository.write !== 'function'
  ) {
    throw new TypeError('CLI commands require a submap repository.')
  }
  if (!output || typeof output.log !== 'function' || typeof output.error !== 'function') {
    throw new TypeError('CLI commands require log and error output capabilities.')
  }
  assertOperations(submapCli, ['run'], 'Submap CLI')
  assertOperations(submapCli?.documents, ['read', 'readStdin'], 'Submap document input')
  assertOperations(submapCli?.git, ['metadata'], 'Submap Git metadata')
  assertOperations(submapCli?.output, ['writeStdout', 'writeStderr'], 'Submap output')
  assertTextWriter(writer)
  assertOperations(detector, ['detect', 'summarize'], 'project detector')
  assertOperations(scanner, ['scan'], 'scanner')
  assertOperations(templates, ['list', 'load'], 'template catalog')
  assertOperations(viewerServer, ['start'], 'viewer server')
}

function assertOperations(implementation, operations, label) {
  if (!implementation || operations.some((operation) => typeof implementation[operation] !== 'function')) {
    throw new TypeError(`CLI commands require a complete ${label} capability.`)
  }
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
