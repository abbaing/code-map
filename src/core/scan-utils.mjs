export const maxSourceFileBytes = 2 * 1024 * 1024
export {
  componentContainerDirs,
  displayLabel,
  escapeRegExp,
  findComponentDirIndex,
  importsOf,
  isBackTestFile,
  isTestFile,
  kebab,
  normalizePath,
  stripCSharpComments,
  stripCSharpStringLiterals,
  stripTsComments,
  tsExtensions
} from '#core/source-analysis.mjs'

export function readText(filePath, fileSystem, maxBytes = maxSourceFileBytes, displayPath = String) {
  assertSourceReaderFileSystem(fileSystem)
  const size = fileSystem.stat(filePath).size
  if (size > maxBytes) {
    throw new SourceFileTooLargeError(filePath, size, maxBytes, displayPath)
  }
  return fileSystem.readText(filePath)
}

export function createSourceReader(fileSystem, displayPath = String, maxBytes = maxSourceFileBytes) {
  assertSourceReaderFileSystem(fileSystem)
  return Object.freeze({
    readText(filePath) {
      return readText(filePath, fileSystem, maxBytes, displayPath)
    }
  })
}

function assertSourceReaderFileSystem(fileSystem) {
  if (!fileSystem || typeof fileSystem.stat !== 'function' || typeof fileSystem.readText !== 'function') {
    throw new TypeError('SourceReader requires stat and readText filesystem capabilities.')
  }
}

export class SourceFileTooLargeError extends Error {
  constructor(filePath, size, limit, displayPath = String) {
    super(`Source file exceeds the ${formatBytes(limit)} scan limit: ${displayPath(filePath)}`)
    this.code = 'SOURCE_FILE_TOO_LARGE'
    this.filePath = filePath
    this.size = size
    this.limit = limit
  }
}

export function walk(dir, predicate = () => true, options = {}) {
  const { fileSystem, resolveChildPath } = options
  assertSourceWalker(fileSystem, resolveChildPath)
  if (!fileSystem.exists(dir)) {
    return []
  }
  const ignoredDirs = new Set(options.ignoredDirs ?? [])
  const displayPath = options.toRepoPath ?? String
  const maxFileBytes = options.maxFileBytes ?? maxSourceFileBytes
  const result = []
  const stack = [dir]

  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of fileSystem.readDirectory(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) {
          stack.push(resolveChildPath(current, entry.name))
        }
        continue
      }
      if (!entry.isFile()) {
        continue
      }

      const fullPath = resolveChildPath(current, entry.name)
      if (!predicate(fullPath)) {
        continue
      }
      const size = fileSystem.stat(fullPath).size
      if (size > maxFileBytes) {
        options.onSkippedFile?.({ filePath: fullPath, size, limit: maxFileBytes })
        continue
      }
      result.push(fullPath)
    }
  }

  return result.sort((a, b) => displayPath(a).localeCompare(displayPath(b)))
}

function assertSourceWalker(fileSystem, resolveChildPath) {
  if (
    !fileSystem ||
    typeof fileSystem.exists !== 'function' ||
    typeof fileSystem.readDirectory !== 'function' ||
    typeof fileSystem.stat !== 'function'
  ) {
    throw new TypeError('SourceWalker requires exists, readDirectory, and stat filesystem capabilities.')
  }
  if (typeof resolveChildPath !== 'function') {
    throw new TypeError('SourceWalker requires a child path resolver.')
  }
}

function formatBytes(bytes) {
  if (bytes % (1024 * 1024) === 0) {
    return `${bytes / (1024 * 1024)} MiB`
  }
  return `${bytes} bytes`
}
