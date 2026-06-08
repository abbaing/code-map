import fs from 'node:fs'
import path from 'node:path'
import { getProjectMap, repoRoot, toRepoPath } from './config.mjs'

export const tsExtensions = ['.ts', '.tsx', '.js', '.jsx']

export const componentContainerDirs = ['components', 'pages']

export function findComponentDirIndex(segments) {
  return Math.max(...componentContainerDirs.map(dir => segments.indexOf(dir)))
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

export function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

export function kebab(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase()
}

export function walk(dir, predicate = () => true) {
  if (!fs.existsSync(dir)) return []
  const ignoredDirs = new Set(getProjectMap().ignoredDirs)
  const result = []
  const stack = [dir]

  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) stack.push(path.join(current, entry.name))
        continue
      }

      const fullPath = path.join(current, entry.name)
      if (predicate(fullPath)) result.push(fullPath)
    }
  }

  return result.sort((a, b) => toRepoPath(a).localeCompare(toRepoPath(b)))
}

export { repoRoot, toRepoPath }
