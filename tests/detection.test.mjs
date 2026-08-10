import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createDetectionFiles, createStackDetectorRegistry, detect, detectSummary } from '#core/detect.mjs'

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

const aliasRoot = path.resolve('alias-project')
const aliasDirectories = new Map([
  [aliasRoot, ['front']],
  [path.join(aliasRoot, 'front'), ['src']],
  [path.join(aliasRoot, 'front', 'src'), []]
])
const aliasFiles = createDetectionFiles({
  exists: (target) => aliasDirectories.has(target) || target === path.join(aliasRoot, 'front', 'tsconfig.json'),
  readText(target) {
    if (target === path.join(aliasRoot, 'front', 'tsconfig.json')) {
      return `{
        // JSONC is valid in tsconfig files.
        "compilerOptions": { "paths": { "@/*": ["src/*",], }, },
      }`
    }
    throw new Error('missing')
  },
  readDirectory: (target) => aliasDirectories.get(target) ?? [],
  stat: (target) => ({ isDirectory: () => aliasDirectories.has(target) })
})
const aliasConfig = detect(aliasRoot, {
  files: aliasFiles,
  detectors: createStackDetectorRegistry({ frontend: [], backend: [] })
})
assert.deepEqual(aliasConfig.imports.aliases, [{ prefix: '@/', path: 'front/src' }])

const readme = fs.readFileSync(new URL(import.meta.resolve('#entry/README.md')), 'utf8')
assert.match(readme, /Specialized source analysis currently covers:/u)
assert.match(readme, /Recognition does not enable a specialized source analyzer/u)
assert.doesNotMatch(readme, /Auto-detection covers React, Vue, Angular/u)

console.log('project detector contract tests passed')
