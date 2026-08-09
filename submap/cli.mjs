import path from 'node:path'
import { createCommandRegistry, defineCommand } from '#core/command-registry.mjs'
import { getConfigPathFromArgs, loadProjectContext } from '#core/config.mjs'
import { assertSubmapRepository } from '#submap/repository.mjs'
import { compareSubmaps, inspectSubmap } from '#submap/diff.mjs'
import { createSubmap } from '#submap/create.mjs'
import { SubmapError } from '#submap/errors.mjs'
import { defaultSubmapFilename } from '#submap/io.mjs'
import { validateSubmap, validateSubmapAgainstGraph } from '#submap/validate.mjs'
import {
  assertOnlyOptions,
  createOptionNames,
  integerOption,
  last,
  parseArgs,
  requiredPositional,
  scalar,
  values
} from '#submap/cli-args.mjs'

export const submapCommands = Object.freeze([
  defineCommand({ id: 'submap.help', matches: ({ args }) => isHelp(args), execute: executeHelp }),
  defineCommand({ id: 'submap.create', matches: ({ args }) => args[0] === 'create', execute: executeCreate }),
  defineCommand({ id: 'submap.inspect', matches: ({ args }) => args[0] === 'inspect', execute: executeInspect }),
  defineCommand({ id: 'submap.validate', matches: ({ args }) => args[0] === 'validate', execute: executeValidate }),
  defineCommand({ id: 'submap.diff', matches: ({ args }) => args[0] === 'diff', execute: executeDiff }),
  defineCommand({ id: 'submap.list', matches: ({ args }) => args[0] === 'list', execute: executeList }),
  defineCommand({ id: 'submap.unknown', matches: () => true, execute: executeUnknown })
])

const submapCommandRegistry = createCommandRegistry(submapCommands)

export async function runSubmapCli(args, context = {}) {
  const platform = assertPlatformCapabilities(context.platform)
  const repository = assertSubmapRepository(context.repository)
  const documents = assertOperations(context.documents, ['read', 'readStdin'], 'Submap document input')
  const git = assertOperations(context.git, ['metadata'], 'Submap Git metadata')
  const output = assertOperations(context.output, ['writeStdout', 'writeStderr'], 'Submap output')
  const optionsForErrors = args.includes('--json-errors')
  try {
    const cwd = context.cwd ?? platform.environment.cwd()
    const result = await submapCommandRegistry.execute({ args, cwd, platform, repository, documents, git, output })
    return result.exitCode
  } catch (error) {
    return reportError(error, optionsForErrors, output)
  }
}

function isHelp(args) {
  return !args[0] || args[0] === 'help' || args.includes('--help')
}

function executeHelp({ output }) {
  writeHelp(output)
  return { exitCode: 0 }
}

function executeCreate(input) {
  const options = parseArgs(input.args.slice(1))
  return { exitCode: createCommand(options, input) }
}

function executeInspect(input) {
  return { exitCode: inspectCommand(parseArgs(input.args.slice(1)), input) }
}

function executeValidate(input) {
  return { exitCode: validateCommand(parseArgs(input.args.slice(1)), input) }
}

function executeDiff(input) {
  return { exitCode: diffCommand(parseArgs(input.args.slice(1)), input) }
}

function executeList(input) {
  return { exitCode: listCommand(parseArgs(input.args.slice(1)), input) }
}

function executeUnknown({ args }) {
  throw new SubmapError('SUBMAP_UNKNOWN_COMMAND', `Unknown submap command: ${args[0]}`, { command: args[0] })
}

function createCommand(options, { cwd, platform, repository, documents, git, output }) {
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

  const request = options.spec
    ? readSpec(last(options.spec), options.positionals[0], documents, cwd)
    : requestFromOptions(options)
  if (!request.id && options.positionals[0]) {
    request.id = options.positionals[0]
  }
  const graphPath = resolveGraphPath(options, cwd, platform)
  const graph = documents.read(graphPath, 'source graph')
  const submap = createSubmap(graph, request, {
    git: git.metadata(cwd),
    clock: platform.clock,
    hash: platform.hash
  })
  const validation = validateSubmap(submap, platform.hash)
  if (!validation.valid) {
    throw new SubmapError(
      'SUBMAP_GENERATED_INVALID',
      'Generated submap failed validation.',
      { errors: validation.errors },
      4
    )
  }

  if (options.stdout) {
    writeJsonStdout(submap, output)
    return 0
  }

  const outputPath = options.output
    ? path.resolve(cwd, last(options.output))
    : path.join(resolveSubmapsDirectory(options, cwd, platform), defaultSubmapFilename(submap))
  const written = repository.write(outputPath, submap, { force: Boolean(options.force) })
  log(
    options,
    `Created ${path.relative(cwd, written)} (${submap.statistics.nodes} nodes, ${submap.statistics.edges} edges).`,
    output
  )
  return 0
}

function inspectCommand(options, { cwd, repository, output }) {
  assertOnlyOptions(options, new Set(['json', 'quiet', 'json-errors', 'non-interactive']))
  const input = requiredPositional(options, 0, 'SUBMAP_INPUT_REQUIRED', 'inspect requires a submap file.')
  const summary = inspectSubmap(repository.read(path.resolve(cwd, input)))
  if (options.json) {
    writeJsonStdout(summary, output)
  } else {
    writeInspection(summary, output)
  }
  return 0
}

function validateCommand(options, { cwd, platform, repository, documents, output }) {
  assertOnlyOptions(options, new Set(['against', 'json', 'quiet', 'json-errors', 'non-interactive']))
  const input = requiredPositional(options, 0, 'SUBMAP_INPUT_REQUIRED', 'validate requires a submap file.')
  const submap = repository.read(path.resolve(cwd, input))
  const internal = validateSubmap(submap, platform.hash)
  const result =
    options.against && internal.valid
      ? validateSubmapAgainstGraph(
          submap,
          documents.read(path.resolve(cwd, last(options.against)), 'source graph'),
          platform.hash
        )
      : internal
  if (options.json) {
    writeJsonStdout(result, output)
  } else {
    writeValidation(result, output)
  }
  if (!result.valid) {
    return options.against && internal.valid ? 5 : 4
  }
  return 0
}

function diffCommand(options, { cwd, repository, output }) {
  assertOnlyOptions(options, new Set(['json', 'quiet', 'json-errors', 'non-interactive']))
  const previousPath = requiredPositional(options, 0, 'SUBMAP_INPUT_REQUIRED', 'diff requires two submap files.')
  const currentPath = requiredPositional(options, 1, 'SUBMAP_INPUT_REQUIRED', 'diff requires two submap files.')
  const result = compareSubmaps(
    repository.read(path.resolve(cwd, previousPath)),
    repository.read(path.resolve(cwd, currentPath))
  )
  if (options.json) {
    writeJsonStdout(result, output)
  } else {
    writeDiff(result, output)
  }
  return 0
}

function listCommand(options, { cwd, platform, repository, output }) {
  assertOnlyOptions(options, new Set(['dir', 'config', 'json', 'quiet', 'json-errors', 'non-interactive']))
  const directory = options.dir ? path.resolve(cwd, last(options.dir)) : resolveSubmapsDirectory(options, cwd, platform)
  const entries = repository.list(directory).map((filePath) => ({
    file: filePath,
    ...inspectSubmap(repository.read(filePath))
  }))
  if (options.json) {
    writeJsonStdout(entries, output)
  } else if (!entries.length) {
    output.writeStdout(`No submaps found in ${directory}\n`)
  } else {
    for (const entry of entries) {
      output.writeStdout(
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

function readSpec(specPath, positionalId, documents, cwd) {
  const request =
    specPath === '-' ? documents.readStdin() : documents.read(path.resolve(cwd, specPath), 'submap request')
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

function writeJsonStdout(value, output) {
  output.writeStdout(`${JSON.stringify(value, null, 2)}\n`)
}

function log(options, message, output) {
  if (!options.quiet) {
    output.writeStderr(`${message}\n`)
  }
}

function reportError(error, json, output) {
  const normalized =
    error instanceof SubmapError
      ? error
      : new SubmapError('SUBMAP_INTERNAL_ERROR', error?.message ?? String(error), {}, 1)
  if (json) {
    output.writeStderr(
      `${JSON.stringify({ error: { code: normalized.code, message: normalized.message, details: normalized.details } })}\n`
    )
  } else {
    output.writeStderr(`Error [${normalized.code}]: ${normalized.message}\n`)
  }
  return normalized.exitCode
}

function writeInspection(summary, output) {
  output.writeStdout(
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

function writeValidation(result, output) {
  output.writeStdout(result.valid ? 'Submap is valid.\n' : 'Submap is invalid.\n')
  for (const issue of result.errors) {
    output.writeStdout(`ERROR ${issue.code}: ${issue.message}\n`)
  }
  for (const issue of result.warnings) {
    output.writeStdout(`WARN ${issue.code}: ${issue.message}\n`)
  }
}

function writeDiff(result, output) {
  output.writeStdout(
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

function writeHelp(output) {
  output.writeStdout(`code-map submap - create and manage portable partial graphs

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

function assertPlatformCapabilities(platform) {
  if (!platform || typeof platform !== 'object') {
    throw new TypeError('Submap commands require platform capabilities.')
  }
  assertOperations(platform.environment, ['cwd', 'variable'], 'Submap environment')
  assertOperations(platform.fileSystem, ['exists'], 'Submap filesystem')
  assertOperations(platform.clock, ['nowIso'], 'Submap clock')
  assertOperations(platform.hash, ['sha256'], 'Submap hash')
  return platform
}

function assertOperations(implementation, operations, label) {
  if (!implementation || typeof implementation !== 'object') {
    throw new TypeError(`${label} capability is required.`)
  }
  for (const operation of operations) {
    if (typeof implementation[operation] !== 'function') {
      throw new TypeError(`${label} must implement ${operation}().`)
    }
  }
  return implementation
}
