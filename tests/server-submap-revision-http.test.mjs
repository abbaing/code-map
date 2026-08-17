import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createViewerRoutes } from '#entry/src/delivery/http-routes.mjs'

const uid = `sha256:${'a'.repeat(64)}`
let received
let response
const application = {
  reviseSubmap(input) {
    received = input
    return { file: 'focused-r2.submap.json', uid: 'sha256:revision', revision: 2 }
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
const route = routes.find(({ id }) => id === 'api.submap-revision')
assert.equal(route.matches('/api/submaps/revisions'), true)

const request = new EventEmitter()
request.headers = {}
const handled = route.handle({ request, response: {} })
request.emit('data', Buffer.from(JSON.stringify({ uid, nodeIds: ['node:a'] })))
request.emit('end')
await handled

assert.deepEqual(received, { uid, nodeIds: ['node:a'] })
assert.deepEqual(response, {
  status: 200,
  body: { ok: true, file: 'focused-r2.submap.json', uid: 'sha256:revision', revision: 2 }
})

console.log('server submap revision HTTP tests passed')
