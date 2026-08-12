import path from 'node:path'
import { assertOnlyOptions, requiredPositional } from '#submap/cli-args.mjs'
import { writeJson } from '#submap/cli-support.mjs'
import { compareSubmaps } from '#submap/diff.mjs'

export function executeDiff(options, { cwd, repository, output }) {
  assertOnlyOptions(options, new Set(['json', 'quiet', 'json-errors', 'non-interactive']))
  const previous = requiredPositional(options, 0, 'SUBMAP_INPUT_REQUIRED', 'diff requires two submap files.')
  const current = requiredPositional(options, 1, 'SUBMAP_INPUT_REQUIRED', 'diff requires two submap files.')
  const result = compareSubmaps(
    repository.read(path.resolve(cwd, previous)),
    repository.read(path.resolve(cwd, current))
  )
  if (options.json) {
    writeJson(result, output)
  } else {
    writeDiff(result, output)
  }
  return 0
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
