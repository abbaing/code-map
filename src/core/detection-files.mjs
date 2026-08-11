import path from 'node:path'
import { parse as parseJsonc } from 'jsonc-parser'

const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', 'bin', 'obj', '.cache'])

export function createDetectionFiles(fileSystem) {
  if (!hasDetectionCapabilities(fileSystem)) {
    throw new TypeError('ProjectDetector requires bounded filesystem capabilities.')
  }
  return Object.freeze({
    exists: (filePath) => fileSystem.exists(filePath),
    readText: (filePath) => fileSystem.readText(filePath),
    readDirectory: (directory, options) => fileSystem.readDirectory(directory, options),
    stat: (filePath) => fileSystem.stat(filePath)
  })
}

export function assertDetectionFiles(files) {
  if (!files || typeof files.exists !== 'function' || typeof files.readText !== 'function') {
    throw new TypeError('ProjectDetector requires detection files.')
  }
}

export function readJson(filePath, files) {
  try {
    return JSON.parse(files.readText(filePath))
  } catch {
    return null
  }
}

export function extractTsconfigPaths(filePath, files) {
  try {
    const paths = parseJsonc(files.readText(filePath))?.compilerOptions?.paths
    return Object.fromEntries(
      Object.entries(paths ?? {})
        .filter(([, values]) => Array.isArray(values) && typeof values[0] === 'string')
        .map(([key, values]) => [key, [values[0]]])
    )
  } catch {
    return {}
  }
}

export function listDirectories(directory, files) {
  if (!files.exists(directory)) {
    return []
  }
  try {
    return files.readDirectory(directory).filter((name) => isDirectory(path.join(directory, name), files))
  } catch {
    return []
  }
}

export function findFileBySuffix(base, suffix, files) {
  try {
    const pending = [base]
    while (pending.length > 0) {
      const match = inspectDirectory(pending.pop(), suffix, files, pending)
      if (match) {
        return match
      }
    }
  } catch {
    /* unreadable trees do not contribute detection evidence */
  }
  return null
}

export function normalizeSeparator(value) {
  return value.replaceAll('\\', '/')
}
export function toRelative(base, target) {
  return normalizeSeparator(path.relative(base, target))
}
export function titleCase(value) {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function inspectDirectory(directory, suffix, files, pending) {
  for (const entry of files.readDirectory(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) {
      pending.push(fullPath)
    } else if (entry.isFile() && entry.name.endsWith(suffix)) {
      return fullPath
    }
  }
  return null
}

function isDirectory(target, files) {
  try {
    return files.stat(target).isDirectory()
  } catch {
    return false
  }
}

function hasDetectionCapabilities(fileSystem) {
  return (
    fileSystem &&
    ['exists', 'readText', 'readDirectory', 'stat'].every((name) => typeof fileSystem[name] === 'function')
  )
}
