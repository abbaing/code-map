import assert from 'node:assert/strict'
import { createEndpointExtractor } from '#core/endpoints.mjs'
import { extractFrontendEndpoints } from '#parsers/typescript-endpoints.mjs'

const source = `
  const baseUrl = '/api/users'
  this.get(baseUrl)
  fetch('/api/users', { method: 'POST' })
  client({ method: 'DELETE', url: '/api/users/42' })
`
assert.deepEqual(extractFrontendEndpoints(source), [
  { url: '/api/users', method: 'GET' },
  { url: '/api/users/42', method: 'DELETE' },
  { url: '/api/users', method: 'POST' }
])

const extractorFactories = [
  () => createEndpointExtractor([{ id: 'fixture', extract: () => [{ url: '/api/orders', method: 'GET' }] }]),
  () =>
    createEndpointExtractor([
      { id: 'empty', extract: () => [] },
      {
        id: 'fixture',
        extract: () => [
          { url: '/api/orders', method: 'GET' },
          { url: '/api/orders', method: 'GET' },
          { url: '/api/orders', method: 'ANY' }
        ]
      }
    ])
]
for (const factory of extractorFactories) {
  assert.deepEqual(factory().extract({ content: '', urlBindings: new Map(), baseUrl: null }), [
    { url: '/api/orders', method: 'GET' }
  ])
}

assert.throws(() => createEndpointExtractor([]), /non-empty array/u)
assert.throws(
  () =>
    createEndpointExtractor([
      { id: 'same', extract() {} },
      { id: 'same', extract() {} }
    ]),
  /Duplicate endpoint extractor/u
)
assert.throws(
  () => createEndpointExtractor([{ id: 'invalid', extract: () => null }]).extract({}),
  /must return an array/u
)

console.log('endpoint extractor contract tests passed')
