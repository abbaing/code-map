import assert from 'node:assert/strict'
import { Graph } from '#core/graph.mjs'
import { findInternalComponentParent, isInternalComponentNode, parentPriority } from '#app/scan-internal-resolution.mjs'
import { trackInternalComponents } from '#app/scan-internals.mjs'

function addNode(graph, id, data) {
  graph.addNode(id, { label: id, layer: 'presentation', module: 'catalog', ...data })
}

function quality(score, summary = `Quality ${score}`) {
  return {
    score,
    summary,
    cohesion: { score },
    coupling: { score },
    related: []
  }
}

const classificationCases = [
  [{ type: 'component', path: 'src/components/Product/_parts/Price.tsx' }, true],
  [{ type: 'page', path: 'src/pages/Orders/_components/Table.tsx' }, true],
  [{ type: 'route', path: 'src/pages/Orders/_components/route.ts' }, false],
  [{ type: 'component', path: 'src/features/Product/_parts/Price.tsx' }, false],
  [{ type: 'component' }, false]
]
for (const [node, expected] of classificationCases) {
  assert.equal(isInternalComponentNode(node), expected)
}

const pathGraph = new Graph()
addNode(pathGraph, 'component:product', {
  type: 'main-component',
  path: 'src/components/Product/index.tsx'
})
addNode(pathGraph, 'component:price', {
  type: 'component',
  path: 'src/components/Product/_parts/Price.tsx'
})
assert.equal(findInternalComponentParent(pathGraph, pathGraph.getNode('component:price')), 'component:product')

const relationGraph = new Graph()
addNode(relationGraph, 'component:shared-price', {
  type: 'component',
  path: 'src/components/_shared/Price.tsx'
})
addNode(relationGraph, 'route:catalog', { type: 'route', path: 'src/routes/catalog.ts' })
addNode(relationGraph, 'component:card', { type: 'component', path: 'src/components/Card/index.tsx' })
addNode(relationGraph, 'component:catalog', {
  type: 'main-component',
  path: 'src/components/Catalog/index.tsx'
})
relationGraph.addEdge('route:catalog', 'component:shared-price', 'renders')
relationGraph.addEdge('component:shared-price', 'component:card', 'imports')
relationGraph.addEdge('component:catalog', 'component:shared-price', 'contains')
assert.equal(
  findInternalComponentParent(relationGraph, relationGraph.getNode('component:shared-price')),
  'component:catalog'
)

const moduleGraph = new Graph()
addNode(moduleGraph, 'component:internal-filter', {
  type: 'subcomponent',
  path: 'src/components/_shared/Filter.tsx'
})
addNode(moduleGraph, 'page:catalog', { type: 'page', path: 'src/pages/Catalog.tsx' })
addNode(moduleGraph, 'component:z-catalog', { type: 'component', path: 'src/components/ZCatalog/index.tsx' })
addNode(moduleGraph, 'component:a-catalog', { type: 'component', path: 'src/components/ACatalog/index.tsx' })
assert.equal(
  findInternalComponentParent(moduleGraph, moduleGraph.getNode('component:internal-filter')),
  'component:a-catalog'
)
assert.deepEqual(
  ['main-component', 'component', 'page', 'route', 'service'].map((type) => parentPriority({ type })),
  [0, 1, 2, 3, 4]
)

const trackingGraph = new Graph()
addNode(trackingGraph, 'component:orders', {
  type: 'main-component',
  path: 'src/components/Orders/index.tsx'
})
addNode(trackingGraph, 'component:total', {
  label: 'Total',
  type: 'component',
  path: 'src/components/Orders/_parts/Total.tsx',
  meta: { quality: quality(6) }
})
addNode(trackingGraph, 'component:items', {
  label: 'Items',
  type: 'subcomponent',
  path: 'src/components/Orders/_parts/Items.tsx',
  meta: { quality: quality(4) }
})
addNode(trackingGraph, 'component:empty', {
  type: 'component',
  path: 'src/components/Orders/_parts/Empty.tsx'
})
addNode(trackingGraph, 'component:orphan', {
  type: 'component',
  module: 'orphaned',
  path: 'src/components/_private/Orphan.tsx',
  meta: { quality: quality(2) }
})

trackInternalComponents(trackingGraph)

const parentQuality = trackingGraph.getNode('component:orders').meta.quality
assert.equal(parentQuality.score, 5)
assert.equal(
  parentQuality.summary,
  'Quality inherited from internal components; 2 internal components tracked; worst Items 4/10'
)
assert.deepEqual(
  parentQuality.internalComponents.map(({ id, score }) => ({ id, score })),
  [
    { id: 'component:items', score: 4 },
    { id: 'component:total', score: 6 }
  ]
)
assert.deepEqual(trackingGraph.getNode('component:items').meta.internalComponent, {
  parentId: 'component:orders',
  role: 'supporting-component'
})
assert.equal(trackingGraph.getNode('component:empty').meta.internalComponent.parentId, 'component:orders')
assert.equal(trackingGraph.getNode('component:orphan').meta.internalComponent, undefined)

console.log('internal component tests passed')
