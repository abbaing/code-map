import path from 'node:path'
import { assertOnlyOptions, last, requiredPositional } from '#submap/cli-args.mjs'
import { writeJson } from '#submap/cli-support.mjs'
import { validateSubmap, validateSubmapAgainstGraph } from '#submap/validate.mjs'

export function executeValidate(options, { cwd, platform, repository, documents, output }) {
  assertOnlyOptions(options, new Set(['against', 'json', 'quiet', 'json-errors', 'non-interactive']))
  const input = requiredPositional(options, 0, 'SUBMAP_INPUT_REQUIRED', 'validate requires a submap file.')
  const submap = repository.read(path.resolve(cwd, input))
  const internal = validateSubmap(submap, platform.hash)
  const result = options.against && internal.valid ? validateAgainst(options, submap, context()) : internal
  if (options.json) {
    writeJson(result, output)
  } else {
    writeValidation(result, output)
  }
  if (!result.valid) {
    return options.against && internal.valid ? 5 : 4
  }
  return 0

  function context() {
    return { cwd, platform, documents }
  }
}

function validateAgainst(options, submap, { cwd, platform, documents }) {
  const graph = documents.read(path.resolve(cwd, last(options.against)), 'source graph')
  return validateSubmapAgainstGraph(submap, graph, platform.hash)
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
