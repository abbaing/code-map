import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { ApplicationInputError } from '#app/server-app.mjs'
import { startServer } from '#entry/server.mjs'
import { SubmapError } from '#submap/errors.mjs'

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'code-map-http-'))
const graphPath = path.join(tempRoot, 'graph.json')
const graph = {
  version: 1,
  generatedAt: '2030-01-02T03:04:05.000Z',
  stats: { nodes: 0, edges: 0 },
  nodes: [],
  edges: []
}
fs.writeFileSync(graphPath, `${JSON.stringify(graph)}\n`, 'utf8')

let activeGraphPath = graphPath
let scanError
let saveError
let traceError
const application = Object.freeze({
  graphPath: () => activeGraphPath,
  projectMap: () => ({ project: { name: 'HTTP Integration' } }),
  scan() {
    if (scanError) {
      throw scanError
    }
    return graph
  },
  saveProjectMap(input) {
    if (saveError) {
      throw saveError
    }
    return { projectMap: input, stats: graph.stats }
  },
  createTraceSubmap(input) {
    if (traceError) {
      throw traceError
    }
    return { file: `${input.id}.submap.json`, uid: 'trace-uid', statistics: { nodes: input.nodeIds.length } }
  }
})

const sessionToken = 'controlled-session-token'
const server = startServer({
  port: 0,
  application,
  sessionToken,
  requestTimeout: 2_000,
  headersTimeout: 1_000,
  keepAliveTimeout: 500,
  socketTimeout: 1_500,
  maxHeadersCount: 12,
  maxRequestsPerSocket: 13,
  log: () => {}
})

await new Promise((resolve, reject) => {
  server.once('listening', resolve)
  server.once('error', reject)
})

try {
  const { port } = server.address()
  const origin = `http://127.0.0.1:${port}`
  const session = { Origin: origin, Cookie: `flag; code-map-session=${sessionToken}; mode=test` }

  assert.equal(server.requestTimeout, 2_000)
  assert.equal(server.headersTimeout, 1_000)
  assert.equal(server.keepAliveTimeout, 500)
  assert.equal(server.timeout, 1_500)
  assert.equal(server.maxHeadersCount, 12)
  assert.equal(server.maxRequestsPerSocket, 13)

  const viewer = await request(port, 'GET', '/')
  assert.equal(viewer.status, 200)
  assert.match(viewer.headers['set-cookie'][0], new RegExp(`^code-map-session=${sessionToken};`, 'u'))
  assert.match(viewer.headers['content-security-policy'], /default-src 'none'/u)

  const servedGraph = await request(port, 'GET', '/graph.json')
  assert.equal(servedGraph.status, 200)
  assert.deepEqual(JSON.parse(servedGraph.body), graph)
  assert.equal((await request(port, 'GET', '/project-map.json')).status, 200)
  assert.match((await request(port, 'GET', '/viewer-utils.js')).headers['content-type'], /^text\/javascript/u)

  activeGraphPath = path.join(tempRoot, 'missing.json')
  assert.equal((await request(port, 'GET', '/graph.json')).status, 404)
  activeGraphPath = graphPath

  assert.equal((await request(port, 'POST', '/api/scan', '', { Origin: origin })).status, 403)
  assert.equal(
    (await request(port, 'POST', '/api/scan', '', { ...session, Origin: 'http://attacker.invalid' })).status,
    403
  )
  assert.equal(
    (await request(port, 'POST', '/api/scan', '', { ...session, Cookie: 'code-map-session=wrong' })).status,
    403
  )

  const scan = await request(port, 'POST', '/api/scan', '', session)
  assert.equal(scan.status, 200)
  assert.deepEqual(JSON.parse(scan.body), { ok: true, stats: graph.stats, generatedAt: graph.generatedAt })

  const projectMap = { schemaVersion: 1, project: { name: 'Updated' } }
  const saved = await request(port, 'POST', '/api/project-map', JSON.stringify(projectMap), session)
  assert.equal(saved.status, 200)
  assert.deepEqual(JSON.parse(saved.body).projectMap, projectMap)

  const trace = await request(
    port,
    'POST',
    '/api/submaps/from-trace',
    JSON.stringify({ id: 'focused', nodeIds: ['node:a'] }),
    session
  )
  assert.equal(trace.status, 200)
  assert.equal(JSON.parse(trace.body).file, 'focused.submap.json')

  assert.equal((await request(port, 'POST', '/api/project-map', '', session)).status, 400)
  assert.equal(
    (await request(port, 'POST', '/api/project-map', '{}', { ...session, 'Content-Length': 1024 * 1024 + 1 })).status,
    413
  )

  saveError = new ApplicationInputError('controlled application input')
  assert.equal((await request(port, 'POST', '/api/project-map', '{}', session)).status, 400)
  saveError = undefined

  traceError = new SubmapError('SUBMAP_OUTPUT_EXISTS', 'submap exists')
  assert.equal((await request(port, 'POST', '/api/submaps/from-trace', '{}', session)).status, 409)
  traceError = new SubmapError('SUBMAP_INVALID', 'invalid submap')
  assert.equal((await request(port, 'POST', '/api/submaps/from-trace', '{}', session)).status, 400)

  const loggedErrors = []
  const originalConsoleError = console.error
  console.error = (error) => loggedErrors.push(error)
  try {
    fs.writeFileSync(graphPath, '{ invalid graph', 'utf8')
    const malformedGraph = await request(port, 'GET', '/graph.json')
    assert.equal(malformedGraph.status, 500)
    assert.equal(JSON.parse(malformedGraph.body).error, 'Internal server error.')

    fs.writeFileSync(graphPath, JSON.stringify({ ...graph, stats: { nodes: 1, edges: 0 } }), 'utf8')
    const inconsistentGraph = await request(port, 'GET', '/graph.json')
    assert.equal(inconsistentGraph.status, 500)
    assert.equal(JSON.parse(inconsistentGraph.body).error, 'Internal server error.')
    fs.writeFileSync(graphPath, `${JSON.stringify(graph)}\n`, 'utf8')

    traceError = new SubmapError('SUBMAP_INTERNAL', 'private submap detail', {}, 1)
    const internalSubmap = await request(port, 'POST', '/api/submaps/from-trace', '{}', session)
    assert.equal(internalSubmap.status, 500)
    assert.equal(JSON.parse(internalSubmap.body).error, 'Internal server error.')

    traceError = undefined
    scanError = new Error('private scan detail')
    const internalScan = await request(port, 'POST', '/api/scan', '', session)
    assert.equal(internalScan.status, 500)
    assert.equal(JSON.parse(internalScan.body).error, 'Internal server error.')
  } finally {
    console.error = originalConsoleError
    scanError = undefined
    traceError = undefined
  }
  assert.equal(loggedErrors.length, 4)

  assert.equal((await request(port, 'POST', '/missing', '', session)).status, 404)
  assert.equal((await request(port, 'GET', '/missing')).status, 404)
  assert.equal(await requestWithoutHost(port), 400)
  assert.equal((await request(port, 'GET', '/', '', { Host: `127.0.0.1:${port + 1}` })).status, 400)
  assert.equal((await request(port, 'GET', '/', '', { Host: `user@127.0.0.1:${port}` })).status, 400)
  assert.equal((await request(port, 'GET', '/', '', { Host: '[invalid' })).status, 400)
} finally {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  fs.rmSync(tempRoot, { recursive: true, force: true })
}

console.log('server HTTP integration tests passed')

function request(port, method, pathname, body = '', headers = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port, path: pathname, method, headers }, (response) => {
      const chunks = []
      response.on('error', reject)
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () =>
        resolve({
          status: response.statusCode,
          body: Buffer.concat(chunks).toString('utf8'),
          headers: response.headers
        })
      )
    })
    request.on('error', reject)
    if (body) {
      request.write(body)
    }
    request.end()
  })
}

function requestWithoutHost(port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port })
    const chunks = []
    socket.setEncoding('utf8')
    socket.on('connect', () => socket.write('GET / HTTP/1.0\r\n\r\n'))
    socket.on('data', (chunk) => chunks.push(chunk))
    socket.on('end', () => resolve(Number(/^HTTP\/1\.1 (\d{3})/u.exec(chunks.join(''))?.[1])))
    socket.on('error', reject)
  })
}
