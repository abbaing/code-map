import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { applyRuntimeLinks } from '#app/scan-runtime-links.mjs'
import { createProjectContext } from '#core/config.mjs'
import { Graph } from '#core/graph.mjs'
import { maxSourceFileBytes, SourceFileTooLargeError } from '#core/scan-utils.mjs'
import { nodePlatform } from '#platform/node.mjs'

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'code-map-runtime-links-'))
const runtimeLinksPath = path.join(fixtureRoot, 'runtime-links.json')

try {
  const graph = graphFixture()
  applyRuntimeLinks(graph, projectContext())
  applyRuntimeLinks(graph, projectContext('missing-runtime-links.json'))
  assert.equal(graph.allEdges().length, 0, 'missing runtime link configuration must leave the graph unchanged')

  fs.writeFileSync(runtimeLinksPath, `${JSON.stringify(runtimeLinksFixture(), null, 2)}\n`, 'utf8')
  applyRuntimeLinks(graph, projectContext('runtime-links.json'))

  assert.deepEqual(
    graph.allEdges(),
    [
      {
        id: 'file:src/frontend/page.ts::calls-api::endpoint:GET /api/accounts',
        from: 'file:src/frontend/page.ts',
        to: 'endpoint:GET /api/accounts',
        type: 'calls-api',
        label: 'runtime observed',
        confidence: 'high',
        source: 'runtime-links',
        evidence: 'runtime observed'
      },
      {
        id: 'file:src/frontend/page.ts::runtime-link::table:accounts',
        from: 'file:src/frontend/page.ts',
        to: 'table:accounts',
        type: 'runtime-link',
        label: 'runtime-link',
        confidence: 'manual',
        source: 'runtime-links',
        evidence: 'file:src/frontend/page.ts -> table:accounts'
      },
      {
        id: 'logical-service::dispatches::entity:Account',
        from: 'logical-service',
        to: 'entity:Account',
        type: 'dispatches',
        label: 'dispatches',
        confidence: 'low',
        source: 'runtime-links',
        evidence: 'logical-service -> entity:Account'
      }
    ],
    'runtime links must resolve paths and ids while preserving defaults and evidence'
  )

  fs.writeFileSync(runtimeLinksPath, '{}\n', 'utf8')
  applyRuntimeLinks(graph, projectContext('runtime-links.json'))
  assert.equal(graph.allEdges().length, 3, 'documents without links must not alter the graph')

  fs.writeFileSync(runtimeLinksPath, '{\n', 'utf8')
  assert.throws(() => applyRuntimeLinks(graph, projectContext('runtime-links.json')), SyntaxError)

  fs.writeFileSync(runtimeLinksPath, 'x'.repeat(maxSourceFileBytes + 1), 'utf8')
  assert.throws(
    () => applyRuntimeLinks(graph, projectContext('runtime-links.json')),
    (error) =>
      error instanceof SourceFileTooLargeError &&
      error.code === 'SOURCE_FILE_TOO_LARGE' &&
      error.limit === maxSourceFileBytes &&
      error.message.includes('runtime-links.json')
  )
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true })
}

console.log('runtime link tests passed')

function projectContext(runtimeLinks) {
  return createProjectContext(
    {
      schemaVersion: 1,
      project: { name: 'Runtime Link Fixture', ...(runtimeLinks ? { runtimeLinks } : {}) },
      sourceRoots: { frontend: 'src/frontend' },
      modules: { shared: 'shared' }
    },
    { repoRoot: fixtureRoot, platform: nodePlatform }
  )
}

function graphFixture() {
  const graph = new Graph()
  for (const [id, type] of [
    ['file:src/frontend/page.ts', 'page'],
    ['endpoint:GET /api/accounts', 'api-endpoint'],
    ['table:accounts', 'table'],
    ['entity:Account', 'entity'],
    ['logical-service', 'service']
  ]) {
    graph.addNode(id, { label: id, type })
  }
  return graph
}

function runtimeLinksFixture() {
  return {
    links: [
      {
        from: 'src\\frontend\\page.ts',
        to: 'endpoint:GET /api/accounts',
        type: 'calls-api',
        reason: 'runtime observed',
        confidence: 'high'
      },
      { from: 'file:src/frontend/page.ts', to: 'table:accounts' },
      { from: 'logical-service', to: 'entity:Account', type: 'dispatches', confidence: 'low' },
      { from: 'missing-service', to: 'entity:Account' },
      { from: 'file:src/frontend/page.ts', to: 'table:missing' },
      { from: '', to: 'entity:Account' }
    ]
  }
}
