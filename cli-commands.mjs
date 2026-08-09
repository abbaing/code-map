import path from 'node:path'
import { getConfigPathFromArgs, loadProjectContext } from './config.mjs'
import { defineCommand } from './command-registry.mjs'
import { detect, detectSummary } from './detect-node.mjs'
import { writeGraph } from './scan.mjs'
import { listTemplates, loadTemplatePlugins } from './templates/registry.mjs'
import { assertTextWriter } from './writer-contract.mjs'

export function createCliCommands({ platform, repository, output, submapCli, writer }) {
  assertDependencies(platform, repository, output, submapCli, writer)
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
    const { runSubmapCli } = await import('./submap/cli.mjs')
    const exitCode = await runSubmapCli(args.slice(1), { cwd: repoRoot, platform, repository, ...submapCli })
    return { exitCode }
  }

  function showHelp() {
    output.log(helpText)
    return { exitCode: 0 }
  }

  function showTemplates() {
    for (const template of listTemplates()) {
      output.log(`${template.id}\t${template.stage}\t${template.description}`)
    }
    return { exitCode: 0 }
  }

  function initialize({ args, repoRoot }) {
    const summary = detectSummary(repoRoot, { fileSystem: platform.fileSystem })
    output.log(
      `Detected: ${summary.frontendFramework ?? 'unknown'} frontend, ${summary.backendStack ?? 'none'} backend, ${summary.moduleCount} modules`
    )
    const config = detect(repoRoot, { fileSystem: platform.fileSystem })
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
    const result = writeGraph(outputPath, projectContext, { writer })
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
    writeGraph(projectContext.resolveGraphOutputPath(), projectContext, { writer })
    const { startServer } = await import('./server.mjs')
    startServer({ projectContext })
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
      const summary = detectSummary(repoRoot, { fileSystem })
      output.log(
        `Auto-detected: ${summary.frontendFramework ?? 'unknown'} + ${summary.backendStack ?? 'none'}, ${summary.moduleCount} modules`
      )
      output.log('Tip: run with --init to generate a project-map.json you can customize.')
      projectContext = loadProjectContext(detect(repoRoot, { fileSystem }), { repoRoot, platform })
      pluginBasePath = path.join(repoRoot, 'project-map.json')
    }
    try {
      await loadTemplatePlugins(projectContext.projectMap, pluginBasePath ?? path.join(repoRoot, 'project-map.json'), {
        allow: args.includes('--allow-plugins')
      })
    } catch (error) {
      output.error(error.message)
      return null
    }
    return projectContext
  }
}

function assertDependencies(platform, repository, output, submapCli, writer) {
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
  assertOperations(submapCli?.documents, ['read', 'readStdin'], 'Submap document input')
  assertOperations(submapCli?.git, ['metadata'], 'Submap Git metadata')
  assertOperations(submapCli?.output, ['writeStdout', 'writeStderr'], 'Submap output')
  assertTextWriter(writer)
}

function assertOperations(implementation, operations, label) {
  if (!implementation || operations.some((operation) => typeof implementation[operation] !== 'function')) {
    throw new TypeError(`CLI commands require a complete ${label} capability.`)
  }
}

const helpText = `code-map - architectural graph generator

Usage:
  node tools/code-map/cli.mjs                  Scan once and serve viewer
  node tools/code-map/cli.mjs --config <path>  Use explicit project-map.json
  node tools/code-map/cli.mjs --init           Detect and write project-map.json, then exit
  node tools/code-map/cli.mjs --init --out <dir>  Write project-map.json to directory
  node tools/code-map/cli.mjs --scan           Scan only, no viewer
  node tools/code-map/cli.mjs --scan --config <path>  Scan with explicit config, no viewer
  node tools/code-map/cli.mjs --allow-plugins  Trust and execute configured plugin modules
  node tools/code-map/cli.mjs --templates      List composable templates
  node tools/code-map/cli.mjs submap --help    Create and manage portable partial graphs
  node tools/code-map/cli.mjs --help           Show this help

Environment variables:
  CODE_MAP_CONFIG   Path to project-map.json (same as --config)
  CODE_MAP_HOST     Viewer server host (default: 127.0.0.1)
  CODE_MAP_PORT     Port for the viewer server (default: 1133)

Config:
  --config may point anywhere in the repo. Plugin paths are resolved relative
  to that project-map.json; a bare graphOutput filename is written beside the config.`
