import assert from 'node:assert/strict'
import { classifyBack, classifyFront, createSourceClassifier, featureFromRepoPath } from '../classify.mjs'

const projectContext = {
  projectMap: {
    modules: {
      shared: 'shared',
      frontendFeaturePattern: '^front/src/features/([^/]+)',
      backendControllerPattern: '^back/Api/Controllers/(.+?)Controller\\.cs$',
      backendProjectFolderPattern: '^back/[^/]+/([^/]+)',
      bootstrapStems: ['program'],
      utilityControllers: ['health'],
      infrastructureFolders: ['infrastructure']
    },
    frontend: {
      componentMainNamePattern: 'Main$',
      classifiers: [
        { contains: '/services/', type: 'service', layer: 'front-service' },
        { contains: '/pages/', type: 'page', layer: 'ui-page' }
      ]
    },
    backend: {
      classifiers: [{ contains: '/Handlers/', type: 'handler', layer: 'application-handler' }]
    }
  }
}

assert.deepEqual(classifyFront('front/src/features/orders/hooks/useOrders.ts', projectContext), [
  'hook',
  'ui-component-logic'
])
assert.deepEqual(classifyFront('front/src/features/orders/components/OrdersMain/index.tsx', projectContext), [
  'main-component',
  'ui-main-component'
])
assert.deepEqual(classifyFront('front/src/features/orders/pages/OrdersPage.tsx', projectContext), ['page', 'ui-page'])
assert.deepEqual(classifyFront('front/src/features/orders/services/orders.ts', projectContext), [
  'service',
  'front-service'
])
assert.deepEqual(classifyBack('back/Api/Orders/Handlers/CreateOrder.cs', projectContext), [
  'handler',
  'application-handler'
])
assert.equal(featureFromRepoPath('front/src/features/orders/index.ts', projectContext), 'orders')
assert.equal(featureFromRepoPath('back/Api/Controllers/HealthController.cs', projectContext), 'shared')

const classifierFactories = [
  () => createSourceClassifier([{ id: 'fixture', classify: () => ['service', 'application'] }]),
  () =>
    createSourceClassifier([
      { id: 'skip', classify: () => null },
      { id: 'fixture', classify: () => ['service', 'application'] }
    ])
]
for (const factory of classifierFactories) {
  assert.deepEqual(factory().classify('src/example.ts', projectContext), ['service', 'application'])
}

assert.throws(
  () =>
    createSourceClassifier([
      { id: 'same', classify() {} },
      { id: 'same', classify() {} }
    ]),
  /Duplicate SourceClassifier/u
)
assert.throws(
  () =>
    createSourceClassifier([{ id: 'invalid', classify: () => ['service'] }]).classify('src/example.ts', projectContext),
  /invalid classification/u
)

console.log('source classifier contract tests passed')
