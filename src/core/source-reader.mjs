export const maxSourceFileBytes = 2 * 1024 * 1024

export function readText(filePath, fileSystem, maxBytes = maxSourceFileBytes, displayPath = String) {
  assertFileSystem(fileSystem)
  const size = fileSystem.stat(filePath).size
  if (size > maxBytes) {
    throw new SourceFileTooLargeError(filePath, size, maxBytes, displayPath)
  }
  return fileSystem.readText(filePath)
}

export function createSourceReader(fileSystem, displayPath = String, maxBytes = maxSourceFileBytes) {
  assertFileSystem(fileSystem)
  return Object.freeze({ readText: (filePath) => readText(filePath, fileSystem, maxBytes, displayPath) })
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

function assertFileSystem(fileSystem) {
  if (!fileSystem || typeof fileSystem.stat !== 'function' || typeof fileSystem.readText !== 'function') {
    throw new TypeError('SourceReader requires stat and readText filesystem capabilities.')
  }
}

function formatBytes(bytes) {
  return bytes % (1024 * 1024) === 0 ? `${bytes / (1024 * 1024)} MiB` : `${bytes} bytes`
}
