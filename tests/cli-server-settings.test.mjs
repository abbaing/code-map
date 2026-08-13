import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  arbitraryConfigDir,
  arbitraryConfigPath,
  arbitraryGraphPath,
  arbitraryRoot,
  cliPath
} from '#tests/cli-smoke.test.mjs'
import { request, requestRaw, withServer } from '#tests/cli-server-harness.mjs'

await withServer(
  ['--config', arbitraryConfigPath, '--allow-plugins'],
  arbitraryRoot,
  cliPath,
  async (port, session) => {
    const current = JSON.parse((await request(port, 'GET', '/project-map.json')).body)
    current.project.name = 'Saved Arbitrary Config App'
    const response = await request(port, 'POST', '/api/project-map', current, session)
    assert.equal(response.status, 200, 'settings save should work when started with --config')
    const saved = JSON.parse(fs.readFileSync(arbitraryConfigPath, 'utf8'))
    assert.equal(
      saved.project.name,
      'Saved Arbitrary Config App',
      'settings save should write back to the explicit config path'
    )

    const invalidSourceRoot = path.join(arbitraryRoot, 'not-a-directory.ts')
    fs.writeFileSync(invalidSourceRoot, 'export const value = 1\n', 'utf8')
    const configBeforeFailedUpdate = fs.readFileSync(arbitraryConfigPath, 'utf8')
    const graphBeforeFailedUpdate = fs.readFileSync(arbitraryGraphPath, 'utf8')
    const failedUpdate = structuredClone(current)
    failedUpdate.project.name = 'Must Roll Back'
    failedUpdate.sourceRoots.frontend = 'not-a-directory.ts'
    const failedUpdateResponse = await request(port, 'POST', '/api/project-map', failedUpdate, session)
    assert.equal(failedUpdateResponse.status, 500, 'a scan failure must reject the project-map update')
    assert.equal(JSON.parse(failedUpdateResponse.body).error, 'Internal server error.')
    assert.equal(
      fs.readFileSync(arbitraryConfigPath, 'utf8'),
      configBeforeFailedUpdate,
      'a failed update must restore the exact previous project-map document'
    )
    assert.equal(
      fs.readFileSync(arbitraryGraphPath, 'utf8'),
      graphBeforeFailedUpdate,
      'a failed update must preserve the previous graph'
    )
    const activeAfterRollback = JSON.parse((await request(port, 'GET', '/project-map.json')).body)
    assert.equal(
      activeAfterRollback.project.name,
      'Saved Arbitrary Config App',
      'a failed update must restore the active project map'
    )
  }
)

await withServer(
  ['--config', arbitraryConfigPath, '--allow-plugins'],
  arbitraryRoot,
  cliPath,
  async (port, session) => {
    const current = JSON.parse((await request(port, 'GET', '/project-map.json')).body)
    const graph = JSON.parse((await request(port, 'GET', '/graph.json')).body)
    const traceNodeId = graph.nodes[0].id
    const malformedResponse = await requestRaw(port, 'POST', '/api/project-map', '{ not json', session)
    assert.equal(malformedResponse.status, 400, 'malformed project-map JSON must return a controlled client error')
    assert.deepEqual(JSON.parse(malformedResponse.body), { ok: false, error: 'Request body must contain valid JSON.' })
    const malformedTraceResponse = await requestRaw(port, 'POST', '/api/submaps/from-trace', '{ not json', session)
    assert.equal(malformedTraceResponse.status, 400, 'malformed trace JSON must return a controlled client error')
    assert.deepEqual(JSON.parse(malformedTraceResponse.body), {
      ok: false,
      error: 'Request body must contain valid JSON.'
    })
    const scalarConfigResponse = await requestRaw(port, 'POST', '/api/project-map', 'null', session)
    assert.equal(scalarConfigResponse.status, 400, 'a project map must be a JSON object')
    assert.match(JSON.parse(scalarConfigResponse.body).error, /Project map must be a JSON object/u)
    const arrayTraceResponse = await requestRaw(port, 'POST', '/api/submaps/from-trace', '[]', session)
    assert.equal(arrayTraceResponse.status, 400, 'a trace request must be a JSON object')
    assert.equal(JSON.parse(arrayTraceResponse.body).error, 'Trace request must be a JSON object.')
    const invalidTraceShape = await request(
      port,
      'POST',
      '/api/submaps/from-trace',
      { id: 42, nodeIds: [traceNodeId], unexpected: true },
      session
    )
    assert.equal(invalidTraceShape.status, 400, 'unknown trace fields and invalid scalar types must be rejected')
    assert.match(JSON.parse(invalidTraceShape.body).error, /Unknown trace request properties: unexpected/u)

    const malformedRuntimeLinksPath = path.join(arbitraryConfigDir, 'malformed-runtime-links.json')
    fs.writeFileSync(malformedRuntimeLinksPath, '{ internal parser detail', 'utf8')
    const malformedRuntimeConfig = structuredClone(current)
    malformedRuntimeConfig.project.runtimeLinks = 'code-map/malformed-runtime-links.json'
    const configBeforeInternalSyntaxError = fs.readFileSync(arbitraryConfigPath, 'utf8')
    const internalSyntaxResponse = await request(port, 'POST', '/api/project-map', malformedRuntimeConfig, session)
    assert.equal(
      internalSyntaxResponse.status,
      500,
      'internal JSON parsing failures must not be classified as client input errors'
    )
    assert.deepEqual(JSON.parse(internalSyntaxResponse.body), { ok: false, error: 'Internal server error.' })
    assert.equal(
      fs.readFileSync(arbitraryConfigPath, 'utf8'),
      configBeforeInternalSyntaxError,
      'internal parsing failures must roll back config updates'
    )
  }
)

await withServer(
  ['--config', arbitraryConfigPath, '--allow-plugins'],
  arbitraryRoot,
  cliPath,
  async (port, session) => {
    const configBeforeInvalidSave = fs.readFileSync(arbitraryConfigPath, 'utf8')
    const invalidConfigResponse = await request(
      port,
      'POST',
      '/api/project-map',
      {
        schemaVersion: 1,
        project: {},
        sourceRoots: {}
      },
      session
    )
    assert.equal(invalidConfigResponse.status, 400, 'invalid project-map documents must be rejected before persistence')
    assert.match(JSON.parse(invalidConfigResponse.body).error, /project\.name is required/u)
    assert.equal(
      fs.readFileSync(arbitraryConfigPath, 'utf8'),
      configBeforeInvalidSave,
      'an invalid save must preserve the last valid config'
    )
  }
)

console.log('cli server settings tests passed')
