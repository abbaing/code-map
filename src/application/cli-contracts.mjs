import { assertTextWriter } from '#core/writer-contract.mjs'

export function assertCliDependencies(dependencies) {
  const { platform, repository, output, submapCli, writer, detector, scanner, templates, viewerServer } = dependencies
  if (!platform?.environment || !platform?.fileSystem) {
    throw new TypeError('CLI commands require platform environment and filesystem capabilities.')
  }
  assertOperations(repository, ['read', 'list', 'write'], 'submap repository')
  assertOperations(output, ['log', 'error'], 'log and error output')
  assertOperations(submapCli, ['run'], 'Submap CLI')
  assertOperations(submapCli?.documents, ['read', 'readStdin'], 'Submap document input')
  assertOperations(submapCli?.git, ['metadata'], 'Submap Git metadata')
  assertOperations(submapCli?.output, ['writeStdout', 'writeStderr'], 'Submap output')
  assertTextWriter(writer)
  assertOperations(detector, ['detect', 'summarize'], 'project detector')
  assertOperations(scanner, ['scan'], 'scanner')
  assertOperations(templates, ['list', 'load'], 'template catalog')
  assertOperations(viewerServer, ['start'], 'viewer server')
  return dependencies
}

function assertOperations(implementation, operations, label) {
  if (!implementation || operations.some((operation) => typeof implementation[operation] !== 'function')) {
    throw new TypeError(`CLI commands require a complete ${label} capability.`)
  }
}
