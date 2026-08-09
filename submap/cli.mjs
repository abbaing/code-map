import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { getConfigPathFromArgs, loadProjectContext } from '../config.mjs'
import { nodePlatform } from '../platform/node.mjs'
import {
  assertOnlyOptions,
  createOptionNames,
  integerOption,
  last,
  parseArgs,
  requiredPositional,
  scalar,
  values
} from './cli-args.mjs'
import {
  SubmapError,
  compareSubmaps,
  createSubmap,
  defaultSubmapFilename,
  inspectSubmap,
  listSubmapFiles,
  readJson,
  readJsonStdin,
  validateSubmap,
  validateSubmapAgainstGraph,
  writeJsonAtomic
} from './index.mjs'

export async function runSubmapCli(args, context = {}) {
  const platform = context.platform ?? nodePlatform
  const optionsForErrors = args.includes('--json-errors')
  try {
    const command = args[0]
    if (!command || command === 'help' || args.includes('--help')) {
      writeHelp()
      return 0
    }
    const parsed = parseArgs(args.slice(1))
    const cwd = context.cwd ?? platform.environment.cwd()
    if (command === 'create') {
      return createCommand(parsed, cwd, platform)
    }
    if (command === 'inspect') {
      return inspectCommand(parsed)
    }
    if (command === 'validate') {
      return validateCommand(parsed)
    }
    if (command === 'diff') {
      return diffCommand(parsed)
    }
    if (command === 'list') {
      return listCommand(parsed, cwd, platform)
    }
    throw new SubmapError('SUBMAP_UNKNOWN_COMMAND', `Unknown submap command: ${command}`, { command })
  } catch (error) {
    return reportError(error, optionsForErrors)
  }
}

function createCommand(options, cwd, platform) {
  assertOnlyOptions(options, createOptionNames())
  if (options.stdout && options.output) {
    throw new SubmapError('SUBMAP_OUTPUT_CONFLICT', '--stdout and --output are mutually exclusive.')
  }
  const specTransportOptions = new Set([
    'positionals',
    'spec',
    'graph',
    'config',
    'output',
    'dir',
    'stdout',
    'quiet',
    'force',
    'json-errors',
    'non-interactive'
  ])
  if (options.spec && Object.keys(options).some((name) => !specTransportOptions.has(name))) {
    throw new SubmapError(
      'SUBMAP_SPEC_CONFLICT',
      '--spec cannot be combined with inline selection, access, revision, or traversal options.'
    )
  }

  const request = options.spec ? readSpec(last(options.spec), options.positionals[0]) : requestFromOptions(options)
  if (!request.id && options.positionals[0]) {
    request.id = options.positionals[0]
  }
  const graphPath = resolveGraphPath(options, cwd, platform)
  const graph = readJson(graphPath, 'source graph')
  const submap = createSubmap(graph, request, {
    git: readGitMetadata(cwd),
    clock: platform.clock,
    hash: platform.hash
  })
  const validation = validateSubmap(submap)
  if (!validation.valid) {
    throw new SubmapError(
      'SUBMAP_GENERATED_INVALID',
      'Generated submap failed validation.',
      { errors: validation.errors },
      4
    )
  }

  if (options.stdout) {
    writeJsonStdout(submap)
    return 0
  }

  const outputPath = options.output
    ? path.resolve(cwd, last(options.output))
    : path.join(resolveSubmapsDirectory(options, cwd, platform), defaultSubmapFilename(submap))
  const written = writeJsonAtomic(outputPath, submap, { force: Boolean(options.force) })
  log(
    options,
    `Created ${path.relative(cwd, written)} (${submap.statistics.nodes} nodes, ${submap.statistics.edges} edges).`
  )
  return 0
}

function inspectCommand(options) {
  assertOnlyOptions(options, new Set(['json', 'quiet', 'json-errors', 'non-interactive']))
  const input = requiredPositional(options, 0, 'SUBMAP_INPUT_REQUIRED', 'inspect requires a submap file.')
  const summary = inspectSubmap(readJson(path.resolve(input), 'submap'))
  if (options.json) {
    writeJsonStdout(summary)
  } else {
    writeInspection(summary)
  }
  return 0
}

function validateCommand(options) {
  assertOnlyOptions(options, new Set(['against', 'json', 'quiet', 'json-errors', 'non-interactive']))
  const input = requiredPositional(options, 0, 'SUBMAP_INPUT_REQUIRED', 'validate requires a submap file.')
  const submap = readJson(path.resolve(input), 'submap')
  const internal = validateSubmap(submap)
  const result =
    options.against && internal.valid
      ? validateSubmapAgainstGraph(submap, readJson(path.resolve(last(options.against)), 'source graph'))
      : internal
  if (options.json) {
    writeJsonStdout(result)
  } else {
    writeValidation(result)
  }
  if (!result.valid) {
    return options.against && internal.valid ? 5 : 4
  }
  return 0
}

function diffCommand(options) {
  assertOnlyOptions(options, new Set(['json', 'quiet', 'json-errors', 'non-interactive']))
  const previousPath = requiredPositional(options, 0, 'SUBMAP_INPUT_REQUIRED', 'diff requires two submap files.')
  const currentPath = requiredPositional(options, 1, 'SUBMAP_INPUT_REQUIRED', 'diff requires two submap files.')
  const result = compareSubmaps(
    readJson(path.resolve(previousPath), 'previous submap'),
    readJson(path.resolve(currentPath), 'current submap')
  )
  if (options.json) {
    writeJsonStdout(result)
  } else {
    writeDiff(result)
  }
  return 0
}

function listCommand(options, cwd, platform) {
  assertOnlyOptions(options, new Set(['dir', 'config', 'json', 'quiet', 'json-errors', 'non-interactive']))
  const directory = options.dir ? path.resolve(cwd, last(options.dir)) : resolveSubmapsDirectory(options, cwd, platform)
  const entries = listSubmapFiles(directory).map((filePath) => ({
    file: filePath,
    ...inspectSubmap(readJson(filePath, 'submap'))
  }))
  if (options.json) {
    writeJsonStdout(entries)
  } else if (!entries.length) {
    process.stdout.write(`No submaps found in ${directory}\n`)
  } else {
    for (const entry of entries) {
      process.stdout.write(
        `${entry.id}\tr${entry.revision}\t${entry.statistics.nodes} nodes\t${path.basename(entry.file)}\n`
      )
    }
  }
  return 0
}

function requestFromOptions(options) {
  const id = options.positionals[0]
  return {
    id,
    revision: integerOption(options, 'revision'),
    parentUid: scalar(options, 'parent'),
    selectors: selectorFromOptions(options),
    traversal: {
      direction: scalar(options, 'direction'),
      maxDepth: integerOption(options, 'depth'),
      edgeTypes: values(options, 'edge'),
      excludedEdgeTypes: values(options, 'exclude-edge')
    },
    exclusions: selectorFromOptions(options, 'exclude-'),
    access: {
      default: scalar(options, 'access-default'),
      editable: accessSelector(options, 'editable'),
      readable: accessSelector(options, 'readable'),
      external: accessSelector(options, 'external'),
      forbidden: accessSelector(options, 'forbidden'),
      generated: accessSelector(options, 'generated')
    }
  }
}

function selectorFromOptions(options, prefix = '') {
  return {
    nodeIds: values(options, `${prefix}node`),
    paths: values(options, `${prefix}path`),
    modules: values(options, `${prefix}module`),
    layers: values(options, `${prefix}layer`),
    types: values(options, `${prefix}type`)
  }
}

function accessSelector(options, level) {
  return {
    nodeIds: values(options, `${level}-node`),
    paths: values(options, `${level}-path`),
    modules: values(options, `${level}-module`),
    layers: values(options, `${level}-layer`),
    types: values(options, `${level}-type`)
  }
}

function readSpec(specPath, positionalId) {
  const request = specPath === '-' ? readJsonStdin() : readJson(path.resolve(specPath), 'submap request')
  if (positionalId && request.id && positionalId !== request.id) {
    throw new SubmapError('SUBMAP_ID_CONFLICT', 'Positional id and spec id do not match.', {
      positionalId,
      specId: request.id
    })
  }
  if (!request.id && positionalId) {
    request.id = positionalId
  }
  return request
}

function resolveGraphPath(options, cwd, platform) {
  if (options.graph) {
    return path.resolve(cwd, last(options.graph))
  }
  const projectContext = loadOptionalProjectContext(options, cwd, platform)
  return projectContext
    ? projectContext.resolveRepoPath(projectContext.projectMap.project.graphOutput)
    : path.join(cwd, 'graph.json')
}

function resolveSubmapsDirectory(options, cwd, platform) {
  if (options.dir) {
    return path.resolve(cwd, last(options.dir))
  }
  const projectContext = loadOptionalProjectContext(options, cwd, platform)
  return projectContext
    ? projectContext.resolveRepoPath(projectContext.projectMap.project.submapsDirectory)
    : path.join(cwd, '.code-map', 'submaps')
}

function loadOptionalProjectContext(options, cwd, platform) {
  const explicit = options.config ? path.resolve(cwd, last(options.config)) : null
  const configPath =
    explicit ??
    getConfigPathFromArgs(
      [
        'node',
        'code-map',
        ...(platform.environment.variable('CODE_MAP_CONFIG')
          ? ['--config', platform.environment.variable('CODE_MAP_CONFIG')]
          : [])
      ],
      { cwd, fileSystem: platform.fileSystem }
    )
  if (!configPath) {
    return null
  }
  if (!platform.fileSystem.exists(configPath)) {
    throw new SubmapError('SUBMAP_CONFIG_NOT_FOUND', 'Project map file not found.', { path: configPath }, 3)
  }
  try {
    return loadProjectContext(configPath, { repoRoot: cwd, platform })
  } catch (error) {
    throw new SubmapError('SUBMAP_CONFIG_INVALID', error.message, { path: configPath })
  }
}

function readGitMetadata(cwd) {
  try {
    const run = (args) =>
      execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    return {
      commit: run(['rev-parse', 'HEAD']),
      branch: run(['branch', '--show-current']) || null,
      dirty: Boolean(run(['status', '--porcelain']))
    }
  } catch {
    return undefined
  }
}

function writeJsonStdout(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function log(options, message) {
  if (!options.quiet) {
    process.stderr.write(`${message}\n`)
  }
}

function reportError(error, json) {
  const normalized =
    error instanceof SubmapError
      ? error
      : new SubmapError('SUBMAP_INTERNAL_ERROR', error?.message ?? String(error), {}, 1)
  if (json) {
    process.stderr.write(
      `${JSON.stringify({ error: { code: normalized.code, message: normalized.message, details: normalized.details } })}\n`
    )
  } else {
    process.stderr.write(`Error [${normalized.code}]: ${normalized.message}\n`)
  }
  return normalized.exitCode
}

function writeInspection(summary) {
  process.stdout.write(
    [
      `${summary.id} (revision ${summary.revision})`,
      `UID: ${summary.uid}`,
      `Project: ${summary.projectName}`,
      `Seeds: ${summary.seedNodeIds.length}`,
      `Nodes: ${summary.statistics.nodes}`,
      `Edges: ${summary.statistics.edges}`,
      `Findings: ${summary.statistics.findings}`,
      `Boundaries: ${summary.statistics.boundaries}`,
      `Editable: ${summary.statistics.editable}`,
      `Readable: ${summary.statistics.readable}`,
      `Modules: ${summary.modules.join(', ') || 'none'}`
    ].join('\n') + '\n'
  )
}

function writeValidation(result) {
  process.stdout.write(result.valid ? 'Submap is valid.\n' : 'Submap is invalid.\n')
  for (const issue of result.errors) {
    process.stdout.write(`ERROR ${issue.code}: ${issue.message}\n`)
  }
  for (const issue of result.warnings) {
    process.stdout.write(`WARN ${issue.code}: ${issue.message}\n`)
  }
}

function writeDiff(result) {
  process.stdout.write(
    [
      `${result.previous.id} r${result.previous.revision} -> r${result.current.revision}`,
      `Nodes: +${result.nodes.added.length} -${result.nodes.removed.length}`,
      `Edges: +${result.edges.added.length} -${result.edges.removed.length}`,
      `Findings: +${result.findings.added.length} -${result.findings.removed.length}`,
      `Access changes: ${result.accessChanges.length}`,
      `Changed: ${result.changed ? 'yes' : 'no'}`
    ].join('\n') + '\n'
  )
}

function writeHelp() {
  process.stdout.write(`code-map submap - create and manage portable partial graphs

Usage:
  code-map submap create <id> --graph <graph.json> [selectors] [--output <file> | --stdout]
  code-map submap create [<id>] --spec <request.json|-> [--graph <graph.json>] [--stdout]
  code-map submap inspect <submap.json> [--json]
  code-map submap validate <submap.json> [--against <graph.json>] [--json]
  code-map submap diff <previous.json> <current.json> [--json]
  code-map submap list [--dir <directory>] [--json]

Selectors:
  --node <id>          --path <glob>       --module <id>
  --layer <id>         --type <id>         --depth <n>
  --direction <incoming|outgoing|both>     --edge <type>
  --exclude-node/path/module/layer/type    --exclude-edge <type>
  --revision <n>        --parent <sha256:uid>

Access selectors:
  --editable-node <id>   --editable-path <glob>
  --readable-node <id>   --forbidden-path <glob>
  The same node/path/module/layer/type suffixes are available for every access level.

Automation:
  --stdout            Write only the submap JSON to stdout
  --quiet             Suppress success diagnostics
  --json-errors       Write structured errors to stderr
  --non-interactive   Explicitly assert non-interactive execution
  --force             Replace an existing output file
`)
}
