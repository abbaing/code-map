import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { arbitraryConfigPath, arbitraryRoot, cliPath, packageRoot } from '#tests/cli-smoke.test.mjs'
import { request, requestRaw, viewerRuntimeModuleNames, withServer } from '#tests/cli-server-harness.mjs'

await withServer(
  ['--config', arbitraryConfigPath, '--allow-plugins'],
  arbitraryRoot,
  cliPath,
  async (port, _session) => {
    const securedViewer = await request(port, 'GET', '/', null)
    const contentSecurityPolicy = securedViewer.headers['content-security-policy']
    assert.match(contentSecurityPolicy, /default-src 'none'/u)
    assert.match(contentSecurityPolicy, /script-src 'self'/u)
    assert.match(contentSecurityPolicy, /script-src-attr 'none'/u, 'inline event handlers must be blocked by policy')
    assert.match(
      contentSecurityPolicy,
      /script-src[^;]*'sha256-/u,
      'the static viewer import map must be hash-authorized'
    )
    assert.doesNotMatch(contentSecurityPolicy, /script-src[^;]*'unsafe-inline'/u)
    assert.match(
      contentSecurityPolicy,
      /style-src-attr 'unsafe-inline'/u,
      'the graph layout must retain its constrained dynamic styles'
    )
    assert.match(contentSecurityPolicy, /frame-ancestors 'none'/u)
    assert.equal(securedViewer.headers['x-content-type-options'], 'nosniff')
    assert.equal(securedViewer.headers['x-frame-options'], 'DENY')
    assert.equal(securedViewer.headers['referrer-policy'], 'no-referrer')
    assert.equal(securedViewer.headers['cross-origin-resource-policy'], 'same-origin')
    assert.equal(securedViewer.headers['permissions-policy'], 'camera=(), geolocation=(), microphone=()')
    const localUtilityCss = await request(port, 'GET', '/tailwind.css', null)
    assert.equal(localUtilityCss.status, 200, 'the viewer utility stylesheet must be served locally')
    assert.match(localUtilityCss.headers['content-type'], /^text\/css/u)
    assert.match(localUtilityCss.body, /tailwindcss v4\.3\.3/u)
    const viewerInteractions = await request(port, 'GET', '/viewer-interactions.mjs', null)
    assert.equal(viewerInteractions.status, 200, 'the viewer interaction module must be served locally')
    assert.match(viewerInteractions.headers['content-type'], /^text\/javascript/u)
    assert.match(viewerInteractions.body, /export function createViewerUiController/u)
    for (const moduleName of viewerRuntimeModuleNames(packageRoot)) {
      const viewerModule = await request(port, 'GET', `/${moduleName}`, null)
      assert.equal(viewerModule.status, 200, `${moduleName} must be served for the viewer module graph`)
      assert.match(viewerModule.headers['content-type'], /^text\/javascript/u)
    }
    assert.equal(
      (await request(port, 'GET', '/viewer-unlisted.js', null)).status,
      404,
      'only explicitly registered viewer assets may be served'
    )
  }
)

await withServer(
  ['--config', arbitraryConfigPath, '--allow-plugins'],
  arbitraryRoot,
  cliPath,
  async (port, session) => {
    const missingSession = await request(port, 'POST', '/api/scan', {})
    assert.equal(missingSession.status, 403, 'mutating endpoints must require a viewer session')
    const crossOrigin = await request(port, 'POST', '/api/scan', {}, { ...session, Origin: 'http://attacker.invalid' })
    assert.equal(crossOrigin.status, 403, 'mutating endpoints must reject cross-origin requests')
    const invalidSession = await request(
      port,
      'POST',
      '/api/scan',
      {},
      { ...session, Cookie: 'code-map-session=invalid' }
    )
    assert.equal(invalidSession.status, 403, 'mutating endpoints must reject invalid session tokens')
    const invalidHost = await request(port, 'GET', '/graph.json', null, { Host: `attacker.invalid:${port}` })
    assert.equal(invalidHost.status, 400, 'requests with an untrusted Host header must be rejected')

    const oversizedPayload = JSON.stringify('x'.repeat(1024 * 1024))
    const oversizedDeclared = await requestRaw(port, 'POST', '/api/project-map', oversizedPayload, session)
    assert.equal(oversizedDeclared.status, 413, 'declared request bodies over 1 MiB must be rejected')
    assert.match(oversizedDeclared.body, /Request body exceeds the 1 MiB limit/u)
    const oversizedChunked = await requestRaw(port, 'POST', '/api/project-map', oversizedPayload, {
      ...session,
      'Transfer-Encoding': 'chunked'
    })
    assert.equal(oversizedChunked.status, 413, 'chunked request bodies over 1 MiB must be rejected while streaming')
    assert.equal(
      (await request(port, 'GET', '/graph.json', null)).status,
      200,
      'an oversized request must not destabilize the server'
    )
  }
)

await withServer(
  ['--config', arbitraryConfigPath, '--allow-plugins'],
  arbitraryRoot,
  cliPath,
  async (port, session) => {
    const scanResponse = await request(port, 'POST', '/api/scan', {}, session)
    assert.equal(scanResponse.status, 200, 'the running viewer must be able to regenerate its graph')
    const scanResult = JSON.parse(scanResponse.body)
    assert.equal(scanResult.ok, true)
    assert.equal(scanResult.stats.nodes > 0, true)

    const servedGraphResponse = await request(port, 'GET', '/graph.json', null)
    assert.equal(servedGraphResponse.status, 200)
    const servedGraph = JSON.parse(servedGraphResponse.body)
    const traceNodeId = servedGraph.nodes[0].id
    const traceResponse = await request(
      port,
      'POST',
      '/api/submaps/from-trace',
      {
        id: 'http-trace',
        nodeIds: [traceNodeId, traceNodeId],
        edgeIds: [],
        selectedNodeId: traceNodeId,
        complete: false
      },
      session
    )
    assert.equal(traceResponse.status, 200, 'a viewer trace must be persisted as a submap')
    const traceResult = JSON.parse(traceResponse.body)
    assert.equal(traceResult.ok, true)
    const tracePath = path.join(arbitraryRoot, traceResult.file)
    assert.equal(fs.existsSync(tracePath), true)
    const traceSubmap = JSON.parse(fs.readFileSync(tracePath, 'utf8'))
    assert.deepEqual(
      traceSubmap.nodes.map((node) => node.id),
      [traceNodeId],
      'trace node ids must be de-duplicated'
    )
    assert.equal(traceSubmap.metadata.kind, 'execution-trace')

    const emptyTrace = await request(
      port,
      'POST',
      '/api/submaps/from-trace',
      { id: 'empty-trace', nodeIds: [] },
      session
    )
    assert.equal(emptyTrace.status, 400)
    assert.match(JSON.parse(emptyTrace.body).error, /non-empty trace selection/u)
  }
)

console.log('cli server security and trace tests passed')
