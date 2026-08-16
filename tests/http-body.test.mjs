import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { HttpRequestError, readJsonRequest, readRequestBody } from '#entry/src/delivery/http-body.mjs'

function requestStream(headers = {}) {
  const request = new PassThrough()
  request.headers = headers
  return request
}

function isRequestError(status, message) {
  return (error) => error instanceof HttpRequestError && error.status === status && error.message === message
}

const validRequest = requestStream({ 'content-length': '25' })
const validBody = readJsonRequest(validRequest)
validRequest.write('{"project":')
validRequest.end('{"name":"Map"}}')
assert.deepEqual(await validBody, { project: { name: 'Map' } })

const boundaryRequest = requestStream({ 'content-length': `${1024 * 1024}` })
const boundaryBody = readRequestBody(boundaryRequest)
boundaryRequest.end(Buffer.alloc(1024 * 1024, 'a'))
assert.equal((await boundaryBody).length, 1024 * 1024)

for (const declaredLength of ['', '-1', '1.5', 'unknown']) {
  const request = requestStream({ 'content-length': declaredLength })
  assert.throws(
    () => readRequestBody(request),
    isRequestError(400, 'Invalid Content-Length header.'),
    `${JSON.stringify(declaredLength)} must not be accepted as a request length`
  )
}

const declaredOversize = requestStream({ 'content-length': `${1024 * 1024 + 1}` })
assert.throws(() => readRequestBody(declaredOversize), isRequestError(413, 'Request body exceeds the 1 MiB limit.'))
assert.equal(declaredOversize.readableFlowing, true, 'a rejected declared body must be drained')

const streamedOversize = requestStream()
const streamedOversizeBody = readRequestBody(streamedOversize)
streamedOversize.write(Buffer.alloc(1024 * 1024))
streamedOversize.end(Buffer.from('x'))
await assert.rejects(streamedOversizeBody, isRequestError(413, 'Request body exceeds the 1 MiB limit.'))

const malformedRequest = requestStream()
const malformedBody = readJsonRequest(malformedRequest)
malformedRequest.end('{"project":')
await assert.rejects(malformedBody, isRequestError(400, 'Request body must contain valid JSON.'))

const abortedRequest = requestStream()
const abortedBody = readRequestBody(abortedRequest)
abortedRequest.write('{"partial":')
abortedRequest.emit('aborted')
abortedRequest.end('true}')
await assert.rejects(abortedBody, isRequestError(400, 'Request body was interrupted.'))

const failedRequest = requestStream()
const failedBody = readRequestBody(failedRequest)
failedRequest.destroy(new Error('private transport failure'))
await assert.rejects(failedBody, isRequestError(400, 'Request body could not be read.'))

console.log('HTTP body tests passed')
