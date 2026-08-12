import path from 'node:path'
import { getConfigPathFromArgs, loadProjectContext } from '#core/config.mjs'
import { last } from '#submap/cli-args.mjs'
import { SubmapError } from '#submap/errors.mjs'
import { assertSubmapRepository } from '#submap/repository.mjs'

export function validateCliContext(context) {
  const platform = assertPlatform(context.platform)
  return {
    platform,
    repository: assertSubmapRepository(context.repository),
    documents: assertOperations(context.documents, ['read', 'readStdin'], 'Submap document input'),
    git: assertOperations(context.git, ['metadata'], 'Submap Git metadata'),
    output: assertOperations(context.output, ['writeStdout', 'writeStderr'], 'Submap output')
  }
}

export function resolveGraphPath(options, cwd, platform) {
  if (options.graph) {
    return path.resolve(cwd, last(options.graph))
  }
  const project = loadOptionalProjectContext(options, cwd, platform)
  return project ? project.resolveGraphOutputPath() : path.join(cwd, 'graph.json')
}

export function resolveSubmapsDirectory(options, cwd, platform) {
  if (options.dir) {
    return path.resolve(cwd, last(options.dir))
  }
  const project = loadOptionalProjectContext(options, cwd, platform)
  return project
    ? project.resolveRepoPath(project.projectMap.project.submapsDirectory)
    : path.join(cwd, '.code-map', 'submaps')
}

export function writeJson(value, output) {
  output.writeStdout(`${JSON.stringify(value, null, 2)}\n`)
}

export function writeUnlessQuiet(options, message, output) {
  if (!options.quiet) {
    output.writeStderr(`${message}\n`)
  }
}

export function reportCliError(error, json, output) {
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

export function writeHelp(output) {
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

function loadOptionalProjectContext(options, cwd, platform) {
  const explicit = options.config ? path.resolve(cwd, last(options.config)) : null
  const configured = platform.environment.variable('CODE_MAP_CONFIG')
  const configPath =
    explicit ??
    getConfigPathFromArgs(['node', 'code-map', ...(configured ? ['--config', configured] : [])], {
      cwd,
      fileSystem: platform.fileSystem
    })
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

function assertPlatform(platform) {
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
