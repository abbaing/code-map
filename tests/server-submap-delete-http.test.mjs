import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createViewerRoutes } from '#entry/src/delivery/http-routes.mjs'

const uid = `sha256:${'a'.repeat(64)}`
let received
let response
const application = {
  deleteSubmap(input) {
    received = input
    return { id: 'focused', deleted: 2 }
  }
}
const responder = {
  sendJson(_response, status, body) {
    response = { status, body }
  }
}
const routes = createViewerRoutes({
  sessionToken: 'test',
  application,
  viewer: { assets: new Map() },
  responder
})
const route = routes.find(({ id }) => id === 'api.delete-submap')
assert.equal(route.method, 'POST')
assert.equal(route.matches('/api/submaps/delete'), true)

const request = new EventEmitter()
request.headers = {}
const handled = route.handle({ request, response: {} })
request.emit('data', Buffer.from(JSON.stringify({ uid })))
request.emit('end')
await handled

assert.equal(received, uid)
assert.deepEqual(response, { status: 200, body: { ok: true, id: 'focused', deleted: 2 } })

console.log('server submap deletion HTTP tests passed')
