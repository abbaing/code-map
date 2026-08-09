import { execFileSync } from 'node:child_process'
import { readJson, readJsonStdin } from '#submap/io.mjs'

export const nodeSubmapCliCapabilities = Object.freeze({
  documents: Object.freeze({ read: readJson, readStdin: readJsonStdin }),
  git: Object.freeze({
    metadata(cwd) {
      try {
        const run = (args) =>
          execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
        return {
          commit: run(['rev-parse', 'HEAD']),
          branch: run(['branch', '--show-current']) || null,
          dirty: Boolean(run(['status', '--porcelain']))
        }
      } catch {
        return undefined
      }
    }
  }),
  output: Object.freeze({
    writeStdout: (value) => process.stdout.write(value),
    writeStderr: (value) => process.stderr.write(value)
  })
})
