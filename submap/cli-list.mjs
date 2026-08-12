import path from 'node:path'
import { assertOnlyOptions, last } from '#submap/cli-args.mjs'
import { resolveSubmapsDirectory, writeJson } from '#submap/cli-support.mjs'
import { inspectSubmap } from '#submap/diff.mjs'

export function executeList(options, { cwd, platform, repository, output }) {
  assertOnlyOptions(options, new Set(['dir', 'config', 'json', 'quiet', 'json-errors', 'non-interactive']))
  const directory = options.dir ? path.resolve(cwd, last(options.dir)) : resolveSubmapsDirectory(options, cwd, platform)
  const entries = repository.list(directory).map((filePath) => ({
    file: filePath,
    ...inspectSubmap(repository.read(filePath))
  }))
  if (options.json) {
    writeJson(entries, output)
  } else {
    writeEntries(entries, directory, output)
  }
  return 0
}

function writeEntries(entries, directory, output) {
  if (!entries.length) {
    output.writeStdout(`No submaps found in ${directory}\n`)
    return
  }
  for (const entry of entries) {
    output.writeStdout(
      `${entry.id}\tr${entry.revision}\t${entry.statistics.nodes} nodes\t${path.basename(entry.file)}\n`
    )
  }
}
