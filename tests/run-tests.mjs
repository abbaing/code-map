import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const testsDirectory = path.dirname(fileURLToPath(import.meta.url))
const streamHelpers = new Set(['package-contents.test.mjs'])
const testFiles = fs
  .readdirSync(testsDirectory)
  .filter((file) => file.endsWith('.test.mjs') && !streamHelpers.has(file))
  .sort()

for (const testFile of testFiles) {
  const result = spawnSync(process.execPath, [path.join(testsDirectory, testFile)], {
    env: process.env,
    stdio: 'inherit'
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
