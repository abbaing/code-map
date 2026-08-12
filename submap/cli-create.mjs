import path from 'node:path'
import { assertOnlyOptions, createOptionNames, integerOption, last, scalar, values } from '#submap/cli-args.mjs'
import { resolveGraphPath, resolveSubmapsDirectory, writeJson, writeUnlessQuiet } from '#submap/cli-support.mjs'
import { createSubmap } from '#submap/create.mjs'
import { SubmapError } from '#submap/errors.mjs'
import { defaultSubmapFilename } from '#submap/io.mjs'
import { validateSubmap } from '#submap/validate.mjs'

const specOptions = new Set([
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

export function executeCreate(options, context) {
  assertCreateOptions(options)
  const request = options.spec
    ? readSpec(last(options.spec), options.positionals[0], context.documents, context.cwd)
    : requestFromOptions(options)
  if (!request.id && options.positionals[0]) {
    request.id = options.positionals[0]
  }
  const graph = context.documents.read(resolveGraphPath(options, context.cwd, context.platform), 'source graph')
  const submap = createSubmap(graph, request, {
    git: context.git.metadata(context.cwd),
    clock: context.platform.clock,
    hash: context.platform.hash
  })
  assertGeneratedSubmap(submap, context.platform.hash)
  if (options.stdout) {
    writeJson(submap, context.output)
    return 0
  }
  const outputPath = options.output
    ? path.resolve(context.cwd, last(options.output))
    : path.join(resolveSubmapsDirectory(options, context.cwd, context.platform), defaultSubmapFilename(submap))
  const written = context.repository.write(outputPath, submap, { force: Boolean(options.force) })
  const counts = `${submap.statistics.nodes} nodes, ${submap.statistics.edges} edges`
  writeUnlessQuiet(options, `Created ${path.relative(context.cwd, written)} (${counts}).`, context.output)
  return 0
}

function assertCreateOptions(options) {
  assertOnlyOptions(options, createOptionNames())
  if (options.stdout && options.output) {
    throw new SubmapError('SUBMAP_OUTPUT_CONFLICT', '--stdout and --output are mutually exclusive.')
  }
  if (options.spec && Object.keys(options).some((name) => !specOptions.has(name))) {
    throw new SubmapError(
      'SUBMAP_SPEC_CONFLICT',
      '--spec cannot be combined with inline selection, access, revision, or traversal options.'
    )
  }
}

function requestFromOptions(options) {
  return {
    id: options.positionals[0],
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
    access: Object.fromEntries([
      ['default', scalar(options, 'access-default')],
      ...['editable', 'readable', 'external', 'forbidden', 'generated'].map((level) => [
        level,
        selectorFromOptions(options, `${level}-`)
      ])
    ])
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

function readSpec(specPath, positionalId, documents, cwd) {
  const request = structuredClone(
    specPath === '-' ? documents.readStdin() : documents.read(path.resolve(cwd, specPath), 'submap request')
  )
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new SubmapError('SUBMAP_INVALID_SPEC', 'Submap request must be a JSON object.')
  }
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

function assertGeneratedSubmap(submap, hash) {
  const validation = validateSubmap(submap, hash)
  if (!validation.valid) {
    throw new SubmapError(
      'SUBMAP_GENERATED_INVALID',
      'Generated submap failed validation.',
      { errors: validation.errors },
      4
    )
  }
}
