import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const debt = JSON.parse(fs.readFileSync(path.join(root, 'architecture/maintainability-debt.json'), 'utf8'))
const extensions = new Set(['.cs', '.css', '.html', '.js', '.json', '.mjs', '.ts', '.tsx', '.yaml', '.yml'])
const ignoredDirectories = new Set(['.cache', '.code-map', '.git', 'build', 'coverage', 'dist', 'node_modules'])
const ignoredFiles = new Set(['package-lock.json', 'viewer/tailwind.css'])
const observedFileDebt = new Set()
const observedLineDebt = new Set()

for (const file of sourceFiles(root)) {
  const repoPath = path.relative(root, file).replaceAll(path.sep, '/')
  const lines = physicalLines(fs.readFileSync(file, 'utf8'))
  if (lines.length > 200) {
    observedFileDebt.add(repoPath)
    assert.ok(debt.files[repoPath], `${repoPath} exceeds 200 lines without a debt entry`)
    assert.ok(lines.length <= debt.files[repoPath], `${repoPath} grew from its ${debt.files[repoPath]}-line baseline`)
  }
  for (const [index, line] of lines.entries()) {
    const length = [...line].length
    if (length <= 200) {
      continue
    }
    const key = `${repoPath}:${index + 1}`
    observedLineDebt.add(key)
    assert.ok(debt.lines[key], `${key} exceeds 200 characters without a debt entry`)
    assert.ok(length <= debt.lines[key], `${key} grew from its ${debt.lines[key]}-character baseline`)
  }
}

assert.deepEqual([...observedFileDebt].sort(), Object.keys(debt.files).sort(), 'file debt entries must be exact')
assert.deepEqual([...observedLineDebt].sort(), Object.keys(debt.lines).sort(), 'line debt entries must be exact')
console.log('code standards ratchet passed')

function sourceFiles(directory) {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) {
      files.push(...sourceFiles(target))
    } else if (entry.isFile()) {
      const repoPath = path.relative(root, target).replaceAll(path.sep, '/')
      if (extensions.has(path.extname(entry.name)) && !ignoredFiles.has(repoPath)) {
        files.push(target)
      }
    }
  }
  return files.sort()
}

function physicalLines(source) {
  const lines = source.replaceAll('\r\n', '\n').split('\n')
  if (lines.at(-1) === '') {
    lines.pop()
  }
  return lines
}
