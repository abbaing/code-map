import assert from 'node:assert/strict'
import {
  assertEdgeRenderer,
  assertLayoutStrategy,
  assertNodeRenderer,
  createEdgeRendererRegistry,
  createLayoutRegistry,
  createNodeRendererRegistry
} from '#viewer/rendering-contracts.mjs'
import { assertViewController, createViewController, createViewControllerRegistry } from '#viewer/view-controller.mjs'
import { createViewerUiController } from '#viewer/viewer-interactions.mjs'
import { configureViewerSelection } from '#viewer/viewer-selection.js'

const layouts = [
  { id: 'grid', layout: ({ nodes }) => nodes.map((node, index) => ({ ...node, x: index, y: 0 })) },
  { id: 'stack', layout: ({ nodes }) => nodes.map((node, index) => ({ ...node, x: 0, y: index })) }
]
for (const layout of layouts) {
  assertLayoutStrategy(layout)
}
const layoutRegistry = createLayoutRegistry(layouts)
assert.deepEqual(layoutRegistry.ids, ['grid', 'stack'])
assert.deepEqual(layoutRegistry.layout('grid', { nodes: [{ id: 'a' }] }), [{ id: 'a', x: 0, y: 0 }])
assert.deepEqual(layoutRegistry.layout('stack', { nodes: [{ id: 'a' }, { id: 'b' }] })[1], {
  id: 'b',
  x: 0,
  y: 1
})
assert.throws(() => layoutRegistry.get('missing'), /Unknown layout strategy/u)
assert.throws(
  () =>
    createLayoutRegistry([
      { id: 'grid', layout() {} },
      { id: 'grid', layout() {} }
    ]),
  /Duplicate/u
)

const nodeRenderers = [
  { id: 'card', render: ({ node }) => `<g>${node.id}</g>` },
  { id: 'compact', render: ({ node }) => `<text>${node.id}</text>` }
]
const edgeRenderers = [
  { id: 'line', render: ({ edge }) => `<path data-id="${edge.id}" />` },
  { id: 'curve', render: ({ edge }) => `<path class="curve" data-id="${edge.id}" />` }
]
for (const renderer of nodeRenderers) {
  assertNodeRenderer(renderer)
}
for (const renderer of edgeRenderers) {
  assertEdgeRenderer(renderer)
}
const nodeRegistry = createNodeRendererRegistry(nodeRenderers)
const edgeRegistry = createEdgeRendererRegistry(edgeRenderers)
assert.equal(nodeRegistry.render('card', { node: { id: 'users' } }), '<g>users</g>')
assert.match(edgeRegistry.render('curve', { edge: { id: 'users:orders' } }), /class="curve"/u)
assert.throws(() => nodeRegistry.render('missing', {}), /Unknown NodeRenderer/u)

const bindings = []
const controllers = [
  {
    id: 'overview',
    bind: ({ root }) => bindings.push(`overview:${root}`),
    render: ({ title }) => `Overview: ${title}`
  },
  {
    id: 'findings',
    bind: ({ root }) => bindings.push(`findings:${root}`),
    render: ({ count }) => `Findings: ${count}`
  }
]
for (const controller of controllers) {
  assertViewController(controller)
}
assert.equal(Object.isFrozen(createViewController(controllers[0])), true)
const controllerRegistry = createViewControllerRegistry(controllers)
controllerRegistry.bindAll({ root: 'viewer' })
assert.deepEqual(bindings, ['overview:viewer', 'findings:viewer'])
assert.equal(controllerRegistry.render('overview', { title: 'Code map' }), 'Overview: Code map')
assert.equal(controllerRegistry.render('findings', { count: 3 }), 'Findings: 3')
assert.throws(() => controllerRegistry.get('settings'), /Unknown view controller/u)
assert.throws(() => createViewController({ id: 'broken', bind() {} }), /render/u)

const listeners = []
const element = {
  addEventListener(type) {
    listeners.push(type)
  },
  classList: {
    add() {},
    remove() {},
    toggle() {},
    contains() {
      return false
    }
  },
  contains() {
    return false
  }
}
const elements = new Proxy(
  { status: { textContent: '' } },
  {
    get(target, property) {
      return target[property] ?? element
    }
  }
)
const operationCalls = []
const operations = new Proxy(
  {
    debounce: (operation) => operation,
    loadGraph: async () => operationCalls.push('load'),
    updateViewUI: () => operationCalls.push('view')
  },
  {
    get(target, property) {
      return target[property] ?? (() => {})
    }
  }
)
const uiController = createViewerUiController({
  state: { zoom: 1, panX: 0, panY: 0, selectedHealth: new Set(), selectedTypes: new Set() },
  elements,
  document: element,
  browser: { setTimeout, clearTimeout },
  clipboard: { async writeText() {} },
  operations
})
assert.equal(Object.isFrozen(uiController), true)
await uiController.start()
const bindingCount = listeners.length
await uiController.start()
assert.deepEqual(operationCalls, ['view', 'load'], 'viewer startup must be idempotent')
assert.equal(listeners.length, bindingCount, 'viewer interactions must bind once')
assert.throws(() => createViewerUiController({}), /state must be an object/u)
assert.throws(() => configureViewerSelection({}), /renderModuleDetail/u)

console.log('viewer extension contract tests passed')
