import fs from 'node:fs'
import path from 'node:path'
import { normalizePath } from './source-analysis.mjs'

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
} from './source-analysis.mjs'

export function readText(filePath, maxBytes = maxSourceFileBytes, displayPath = toRepoPath) {
  const size = fs.statSync(filePath).size
  if (size > maxBytes) {
    throw new SourceFileTooLargeError(filePath, size, maxBytes, displayPath)
  }
  return fs.readFileSync(filePath, 'utf8')
}

export class SourceFileTooLargeError extends Error {
  constructor(filePath, size, limit, displayPath = toRepoPath) {
    super(`Source file exceeds the ${formatBytes(limit)} scan limit: ${displayPath(filePath)}`)
    this.code = 'SOURCE_FILE_TOO_LARGE'
    this.filePath = filePath
    this.size = size
    this.limit = limit
  }
}

export function walk(dir, predicate = () => true, options = {}) {
  if (!fs.existsSync(dir)) {
    return []
  }
  const ignoredDirs = new Set(options.ignoredDirs ?? [])
  const displayPath = options.toRepoPath ?? toRepoPath
  const maxFileBytes = options.maxFileBytes ?? maxSourceFileBytes
  const result = []
  const stack = [dir]

  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) {
          stack.push(path.join(current, entry.name))
        }
        continue
      }
      if (!entry.isFile()) {
        continue
      }

      const fullPath = path.join(current, entry.name)
      if (!predicate(fullPath)) {
        continue
      }
      const size = fs.statSync(fullPath).size
      if (size > maxFileBytes) {
        options.onSkippedFile?.({ filePath: fullPath, size, limit: maxFileBytes })
        continue
      }
      result.push(fullPath)
    }
  }

  return result.sort((a, b) => displayPath(a).localeCompare(displayPath(b)))
}

function formatBytes(bytes) {
  if (bytes % (1024 * 1024) === 0) {
    return `${bytes / (1024 * 1024)} MiB`
  }
  return `${bytes} bytes`
}

export function toRepoPath(filePath) {
  return normalizePath(path.relative(process.cwd(), filePath))
}
