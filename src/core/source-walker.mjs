import { maxSourceFileBytes } from '#core/source-reader.mjs'

export function walk(directory, predicate = () => true, options = {}) {
  const context = createWalkContext(predicate, options)
  if (!context.fileSystem.exists(directory)) {
    return []
  }
  const result = []
  const pending = [directory]
  while (pending.length > 0) {
    inspectDirectory(pending.pop(), pending, result, context)
  }
  return result.sort((left, right) => context.displayPath(left).localeCompare(context.displayPath(right)))
}

function createWalkContext(predicate, options) {
  const { fileSystem, resolveChildPath } = options
  assertSourceWalker(fileSystem, resolveChildPath)
  return {
    predicate,
    fileSystem,
    resolveChildPath,
    ignoredDirectories: new Set(options.ignoredDirs ?? []),
    displayPath: options.toRepoPath ?? String,
    maxFileBytes: options.maxFileBytes ?? maxSourceFileBytes,
    onSkippedFile: options.onSkippedFile
  }
}

function inspectDirectory(directory, pending, result, context) {
  const entries = context.fileSystem.readDirectory(directory, { withFileTypes: true })
  for (const entry of entries) {
    inspectEntry(directory, entry, pending, result, context)
  }
}

function inspectEntry(directory, entry, pending, result, context) {
  if (entry.isDirectory()) {
    if (!context.ignoredDirectories.has(entry.name)) {
      pending.push(context.resolveChildPath(directory, entry.name))
    }
    return
  }
  if (!entry.isFile()) {
    return
  }
  const filePath = context.resolveChildPath(directory, entry.name)
  if (!context.predicate(filePath)) {
    return
  }
  const size = context.fileSystem.stat(filePath).size
  if (size > context.maxFileBytes) {
    context.onSkippedFile?.({ filePath, size, limit: context.maxFileBytes })
    return
  }
  result.push(filePath)
}

function assertSourceWalker(fileSystem, resolveChildPath) {
  const methods = ['exists', 'readDirectory', 'stat']
  if (!fileSystem || methods.some((name) => typeof fileSystem[name] !== 'function')) {
    throw new TypeError('SourceWalker requires exists, readDirectory, and stat filesystem capabilities.')
  }
  if (typeof resolveChildPath !== 'function') {
    throw new TypeError('SourceWalker requires a child path resolver.')
  }
}
