import assert from 'node:assert/strict'
import path from 'node:path'
import { createDetectionFiles, createStackDetectorRegistry, detectSummary } from '../detect.mjs'

const repoRoot = path.resolve('virtual-project')
const directories = new Map([
  [path.join(repoRoot, 'front', 'src'), ['features']],
  [path.join(repoRoot, 'front', 'src', 'features'), ['orders']]
])
const files = createDetectionFiles({
  exists: (target) =>
    directories.has(target) || target === path.join(repoRoot, 'back') || target === path.join(repoRoot, 'front'),
  readText() {
    throw new Error('missing')
  },
  readDirectory: (target) => directories.get(target) ?? [],
  stat: () => ({ isDirectory: () => true })
})

const registries = [
  createStackDetectorRegistry({
    frontend: [{ id: 'custom-ui', detect: () => true }],
    backend: [{ id: 'custom-api', detect: () => true }]
  }),
  createStackDetectorRegistry({
    frontend: [{ id: 'custom-ui', detect: ({ dependencies }) => Object.keys(dependencies).length === 0 }],
    backend: [{ id: 'custom-api', detect: ({ backendPath }) => backendPath.endsWith('back') }]
  })
]

for (const detectors of registries) {
  const summary = detectSummary(repoRoot, { files, detectors })
  assert.equal(summary.frontendRoot, 'front/src')
  assert.equal(summary.backendRoot, 'back')
  assert.equal(summary.frontendFramework, 'custom-ui')
  assert.equal(summary.backendStack, 'custom-api')
  assert.equal(summary.moduleCount, 1)
}

assert.throws(
  () =>
    createStackDetectorRegistry({
      frontend: [
        { id: 'duplicate', detect() {} },
        { id: 'duplicate', detect() {} }
      ]
    }),
  /Duplicate frontend detector/u
)
assert.throws(() => createDetectionFiles({ exists() {} }), /bounded filesystem capabilities/u)
assert.throws(() => detectSummary(repoRoot), /requires detection files/u)

console.log('project detector contract tests passed')
