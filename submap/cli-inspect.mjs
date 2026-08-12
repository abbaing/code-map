import path from 'node:path'
import { assertOnlyOptions, requiredPositional } from '#submap/cli-args.mjs'
import { writeJson } from '#submap/cli-support.mjs'
import { inspectSubmap } from '#submap/diff.mjs'

export function executeInspect(options, { cwd, repository, output }) {
  assertOnlyOptions(options, new Set(['json', 'quiet', 'json-errors', 'non-interactive']))
  const input = requiredPositional(options, 0, 'SUBMAP_INPUT_REQUIRED', 'inspect requires a submap file.')
  const summary = inspectSubmap(repository.read(path.resolve(cwd, input)))
  if (options.json) {
    writeJson(summary, output)
  } else {
    writeInspection(summary, output)
  }
  return 0
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
