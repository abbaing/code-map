import assert from 'node:assert/strict'
import { createBackendAnalysisSession } from '../backend-analysis-session.mjs'

const first = createBackendAnalysisSession([
  {
    file: '/first/IOrders.cs',
    fileName: 'IOrders.cs',
    declarations: [{ kind: 'interface', name: 'IOrders', baseTypes: [] }]
  },
  {
    file: '/first/Orders.cs',
    fileName: 'Orders.cs',
    declarations: [{ kind: 'class', name: 'Orders', baseTypes: ['IOrders'] }]
  }
])
const second = createBackendAnalysisSession([
  {
    file: '/second/Orders.cs',
    fileName: 'Orders.cs',
    declarations: [{ kind: 'class', name: 'Orders', baseTypes: [] }]
  }
])

assert.deepEqual(first.filesNamed('orders.cs'), ['/first/Orders.cs'])
assert.deepEqual(second.filesNamed('orders.cs'), ['/second/Orders.cs'])
assert.equal(first.implementationsOf('IOrders')[0].file, '/first/Orders.cs')
assert.deepEqual(second.implementationsOf('IOrders'), [])
assert.equal(first.declarationsNamed('Orders')[0].file, '/first/Orders.cs')
assert.equal(Object.isFrozen(first), true)
assert.equal(Object.isFrozen(first.filesNamed('Orders.cs')), true)
assert.throws(() => first.filesNamed('Orders.cs').push('/other/Orders.cs'), TypeError)
assert.deepEqual(first.filesNamed('Orders.cs'), ['/first/Orders.cs'], 'query results must not mutate session indexes')

assert.throws(() => createBackendAnalysisSession({}), /entries must be an array/u)
assert.throws(
  () => createBackendAnalysisSession([{ file: '/invalid.cs', declarations: [] }]),
  /requires a file, file name, and declarations/u
)

console.log('backend analysis session tests passed')
