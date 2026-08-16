import assert from 'node:assert/strict'
import http from 'node:http'
import {
  assertRoute,
  assertRouteRegistry,
  createRouteRegistry,
  defineRoute,
  routeContract
} from '#core/http-routes.mjs'
import { startServer } from '#entry/server.mjs'

const customRoute = defineRoute({
  id: 'test.custom',
  method: 'GET',
  matches: (pathname) => pathname === '/custom',
  handle: ({ response, application }) => {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ project: application.projectMap().project.name }))
  }
})
const mutationRoute = defineRoute({
  id: 'test.mutation',
  method: 'POST',
  matches: (pathname) => pathname === '/mutation',
  handle: ({ response }) => {
    response.writeHead(204)
    response.end()
  }
})
const defaultRegistry = createRouteRegistry([customRoute, mutationRoute])
const lookups = []
const delegatedRegistry = Object.freeze({
  find(method, pathname) {
    lookups.push([method, pathname])
    return defaultRegistry.find(method, pathname)
  }
})

assert.deepEqual(routeContract, ['id', 'method', 'matches', 'handle'])
assert.equal(Object.isFrozen(customRoute), true)
assert.equal(Object.isFrozen(defaultRegistry), true)
assert.equal(Object.isFrozen(defaultRegistry.routes), true)
assert.equal(assertRoute(customRoute), customRoute)
assert.equal(assertRouteRegistry(delegatedRegistry), delegatedRegistry)
assert.deepEqual(defaultRegistry.find('GET', '/custom'), customRoute)
assert.equal(defaultRegistry.find('POST', '/custom'), undefined)
assert.throws(() => createRouteRegistry([customRoute, customRoute]), /Route id must be unique/u)
assert.throws(
  () => defineRoute({ id: 'invalid', method: 'get', matches: () => true, handle: () => {} }),
  /uppercase HTTP method/u
)
assert.throws(() => defineRoute({ id: 'invalid', method: 'GET', matches: () => true }), /must implement handle/u)
assert.throws(() => assertRouteRegistry({}), /must implement find/u)

const application = Object.freeze({
  graphPath: () => '',
  projectMap: () => ({ project: { name: 'Injected Routes' } }),
  scan: () => ({}),
  saveProjectMap: () => ({}),
  listSubmaps: () => [],
  createSelectionSubmap: () => ({}),
  createTraceSubmap: () => ({})
})
const server = startServer({ port: 0, application, routeRegistry: delegatedRegistry, log: () => {} })
await new Promise((resolve, reject) => {
  server.once('listening', resolve)
  server.once('error', reject)
})
try {
  const address = server.address()
  const custom = await request(address.port, 'GET', '/custom')
  assert.equal(custom.status, 200)
  assert.deepEqual(JSON.parse(custom.body), { project: 'Injected Routes' })
  assert.equal((await request(address.port, 'GET', '/missing')).status, 404)
  assert.equal((await request(address.port, 'POST', '/mutation')).status, 403)
  assert.deepEqual(lookups, [
    ['GET', '/custom'],
    ['GET', '/missing']
  ])
} finally {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
}

console.log('HTTP route contract tests passed')

function request(port, method, pathname) {
  return new Promise((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port, path: pathname, method }, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }))
    })
    request.on('error', reject)
    request.end()
  })
}
