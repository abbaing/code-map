import fs from 'node:fs'
import path from 'node:path'
import { getProjectMap, repoRoot, toRepoPath } from './config.mjs'

export const tsExtensions = ['.ts', '.tsx', '.js', '.jsx']
export const maxSourceFileBytes = 2 * 1024 * 1024

export const componentContainerDirs = ['components', 'pages']

export function findComponentDirIndex(segments) {
  return Math.max(...componentContainerDirs.map((dir) => segments.indexOf(dir)))
}

export function isTestFile(filePath) {
  return /\.(spec|test)\.[cm]?[jt]sx?$/u.test(filePath)
}

export function isBackTestFile(repoPath) {
  return /\/[^/]*\.Tests\//i.test(repoPath)
}

export function displayLabel(repoPath) {
  const parsed = path.posix.parse(repoPath)
  if (parsed.name === 'index') {
    return path.posix.basename(parsed.dir)
  }
  return parsed.base
}

export function normalizePath(input) {
  return input.replaceAll('\\', '/')
}

export function readText(filePath, maxBytes = maxSourceFileBytes) {
  const size = fs.statSync(filePath).size
  if (size > maxBytes) {
    throw new SourceFileTooLargeError(filePath, size, maxBytes)
  }
  return fs.readFileSync(filePath, 'utf8')
}

export class SourceFileTooLargeError extends Error {
  constructor(filePath, size, limit) {
    super(`Source file exceeds the ${formatBytes(limit)} scan limit: ${toRepoPath(filePath)}`)
    this.code = 'SOURCE_FILE_TOO_LARGE'
    this.filePath = filePath
    this.size = size
    this.limit = limit
  }
}

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function stripCSharpStringLiterals(content) {
  return content
    .replace(/\$?"""[\s\S]*?"""/g, '""')
    .replace(/@(?:"(?:""|[^"])*")/g, '""')
    .replace(/\$?"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])'/g, "''")
}

export function stripCSharpComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

export function stripTsComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

export function importsOf(content) {
  return [...stripTsComments(content).matchAll(/(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g)].map(
    (match) => ({ specifier: match[1], index: match.index ?? 0 })
  )
}

export function kebab(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase()
}

export function walk(dir, predicate = () => true, options = {}) {
  if (!fs.existsSync(dir)) {
    return []
  }
  const ignoredDirs = new Set(getProjectMap().ignoredDirs)
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

  return result.sort((a, b) => toRepoPath(a).localeCompare(toRepoPath(b)))
}

function formatBytes(bytes) {
  if (bytes % (1024 * 1024) === 0) {
    return `${bytes / (1024 * 1024)} MiB`
  }
  return `${bytes} bytes`
}

export { repoRoot, toRepoPath }
