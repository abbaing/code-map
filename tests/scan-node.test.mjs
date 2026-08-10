import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runNodeScan } from '#node/scan-node.mjs'
import { createNodePlatform } from '#platform/node.mjs'

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'code-map-node-scan-'))

try {
  const firstRoot = createProject('first', 'First Project')
  const firstPlatform = createPlatform(firstRoot, ['--config', 'project-map.json', '--out', 'custom/graph.json'])
  const first = await runNodeScan({ platform: firstPlatform })
  const firstOutput = path.join(firstRoot, 'custom', 'graph.json')

  assert.equal(first.outputPath, firstOutput, '--out must resolve against the injected working directory')
  assert.equal(first.projectContext.platform, firstPlatform)
  assert.equal(first.projectContext.projectMap.project.name, 'First Project')
  assert.equal(first.result.stats.nodes > 0, true)
  assert.equal(fs.existsSync(firstOutput), true)
  assert.equal(JSON.parse(fs.readFileSync(firstOutput, 'utf8')).projectMap.project.name, 'First Project')

  const secondRoot = createProject('second', 'Second Project')
  const secondPlatform = createPlatform(secondRoot, [], { CODE_MAP_CONFIG: 'project-map.json' })
  const second = await runNodeScan({ platform: secondPlatform })
  const secondOutput = path.join(secondRoot, '.code-map', 'graph.json')

  assert.equal(second.outputPath, secondOutput)
  assert.equal(second.projectContext.projectMap.project.name, 'Second Project')
  assert.notEqual(second.projectContext, first.projectContext)
  assert.notEqual(second.projectContext.repoRoot, first.projectContext.repoRoot)
  assert.equal(fs.existsSync(secondOutput), true)

  const failingPlatform = createPlatform(firstRoot, ['--config', 'project-map.json'])
  const readFailure = new Error('controlled read failure')
  const platformWithFailure = Object.freeze({
    ...failingPlatform,
    fileSystem: Object.freeze({
      ...failingPlatform.fileSystem,
      readText() {
        throw readFailure
      }
    })
  })
  await assert.rejects(
    runNodeScan({ platform: platformWithFailure }),
    /Failed to read project map at project-map\.json: controlled read failure/u
  )

  const executableRoot = createProject('executable', 'Executable Project')
  const executableOutput = path.join(executableRoot, 'direct', 'graph.json')
  const scanEntry = fileURLToPath(import.meta.resolve('#node/scan-node.mjs'))
  const stdout = execFileSync(
    process.execPath,
    [scanEntry, '--config', 'project-map.json', '--out', executableOutput],
    { cwd: executableRoot, encoding: 'utf8' }
  )

  assert.match(stdout, /Code map written to direct\/graph\.json \(\d+ nodes, \d+ edges, \d+ orphans\)\./u)
  assert.equal(fs.existsSync(executableOutput), true)
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true })
}

console.log('Node scan adapter tests passed')

function createProject(directory, name) {
  const root = path.join(tempRoot, directory)
  fs.mkdirSync(path.join(root, 'src'), { recursive: true })
  fs.writeFileSync(path.join(root, 'src', 'index.ts'), `export const project = '${name}'\n`, 'utf8')
  fs.writeFileSync(
    path.join(root, 'project-map.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        project: { name, graphOutput: '.code-map/graph.json' },
        sourceRoots: { frontend: 'src' },
        templates: { enabled: ['filesystem', 'typescript', 'react'] }
      },
      null,
      2
    )}\n`,
    'utf8'
  )
  return root
}

function createPlatform(root, args, env = {}) {
  return createNodePlatform({
    processRef: {
      argv: ['node', 'scan-node.mjs', ...args],
      env,
      cwd: () => root,
      exit: (code) => {
        throw new Error(`Unexpected exit ${code}.`)
      }
    }
  })
}
