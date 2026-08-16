import assert from 'node:assert/strict'
import { orderDomainClusterForEdges, seededUnit } from '#viewer/viewer-layout-circular.js'
import { state } from '#viewer/viewer-state.js'

const smallCluster = [{ id: 'account' }, { id: 'role' }, { id: 'permission' }]
state.graph = { edges: [] }
assert.equal(
  orderDomainClusterForEdges(smallCluster),
  smallCluster,
  'small domain clusters must retain their scanner order'
)

const nodes = ['account', 'role', 'permission', 'team', 'membership'].map((id) => ({ id }))
state.graph = {
  edges: [
    { from: 'account', to: 'permission', type: 'domain-relation' },
    { from: 'role', to: 'team', type: 'domain-relation' },
    { from: 'account', to: 'membership', type: 'domain-relation' },
    { from: 'account', to: 'external', type: 'domain-relation' },
    { from: 'role', to: 'permission', type: 'imports' }
  ]
}

const firstOrder = orderDomainClusterForEdges(nodes)
const secondOrder = orderDomainClusterForEdges(nodes)
assert.deepEqual(
  firstOrder.map((node) => node.id),
  ['team', 'role', 'permission', 'account', 'membership'],
  'crossing domain relations must produce the established circular order'
)
assert.deepEqual(secondOrder, firstOrder, 'circular ordering must be deterministic')
assert.deepEqual(
  nodes.map((node) => node.id),
  ['account', 'role', 'permission', 'team', 'membership'],
  'ordering must not mutate scanner output'
)

state.graph = {
  edges: [
    { from: 'account', to: 'role', type: 'domain-relation' },
    { from: 'account', to: 'permission', type: 'imports' }
  ]
}
assert.equal(
  orderDomainClusterForEdges(nodes),
  nodes,
  'a cluster without enough domain relations must retain its original array'
)

assert.equal(seededUnit('catalog'), 0.2248)
assert.equal(seededUnit('catalog'), seededUnit('catalog'))
for (const id of nodes.map((node) => node.id)) {
  assert.equal(seededUnit(id) >= 0 && seededUnit(id) < 1, true)
}

console.log('viewer circular layout tests passed')
