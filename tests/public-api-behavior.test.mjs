import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  createNodePlatform,
  createProjectContext,
  loadProjectContext,
  nodePlatform,
  validateGraphDocument,
  writeGraph
} from '@abbaing/code-map'

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'code-map-public-api-'))
const sourceRoot = path.join(tempRoot, 'src')
const configPath = path.join(tempRoot, 'project-map.json')
const outputPath = path.join(tempRoot, '.code-map', 'public-api.graph.json')
const projectMap = {
  schemaVersion: 1,
  project: { name: 'Public API fixture', graphOutput: '.code-map/public-api.graph.json' },
  sourceRoots: { frontend: 'src' },
  templates: { enabled: ['filesystem', 'typescript', 'react'] }
}

try {
  fs.mkdirSync(sourceRoot, { recursive: true })
  fs.writeFileSync(
    path.join(sourceRoot, 'account-service.ts'),
    'export function accountName(id: string) { return `account:${id}` }\n',
    'utf8'
  )
  fs.writeFileSync(configPath, `${JSON.stringify(projectMap, null, 2)}\n`, 'utf8')

  const created = createProjectContext(projectMap, { repoRoot: tempRoot })
  assert.equal(created.platform, nodePlatform, 'the root API must inject the Node platform by default')
  assert.equal(created.projectMap.project.name, 'Public API fixture')
  assert.equal(created.resolveGraphOutputPath(), outputPath)

  const customPlatform = createNodePlatform({
    processRef: {
      argv: ['node', 'public-api.test.mjs'],
      env: {},
      cwd: () => tempRoot,
      exit(code) {
        throw new Error(`Unexpected exit ${code}`)
      }
    }
  })
  const custom = createProjectContext(projectMap, { repoRoot: tempRoot, platform: customPlatform })
  assert.equal(custom.platform, customPlatform, 'an explicitly injected platform must not be replaced')

  const loaded = loadProjectContext(configPath, { repoRoot: tempRoot })
  assert.equal(loaded.platform, nodePlatform)
  assert.equal(loaded.configPath, configPath)
  assert.equal(loaded.projectMap.project.name, 'Public API fixture')

  const graph = writeGraph(undefined, loaded)
  assert.equal(fs.existsSync(outputPath), true)
  assert.equal(validateGraphDocument(graph), graph)
  assert.equal(graph.projectMap.project.name, 'Public API fixture')
  assert.equal(
    graph.nodes.some((node) => node.path === 'src/account-service.ts'),
    true
  )
  assert.deepEqual(JSON.parse(fs.readFileSync(outputPath, 'utf8')), graph)
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true })
}

console.log('public API behavior tests passed')
