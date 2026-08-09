import assert from 'node:assert/strict'
import path from 'node:path'
import { createImportResolver, resolveTsImport } from '#core/resolve.mjs'

const repoRoot = path.resolve('virtual-project')
const existingFiles = new Set([
  path.join(repoRoot, 'src', 'features', 'orders', 'service.ts'),
  path.join(repoRoot, 'src', 'shared', 'button', 'index.tsx')
])
const projectContext = {
  projectMap: { imports: { aliases: [{ prefix: '@/', path: 'src' }] } },
  platform: { fileSystem: { exists: (candidate) => existingFiles.has(candidate) } },
  resolveRepoPath: (repoPath) => path.resolve(repoRoot, repoPath),
  resolvePathFrom: (basePath, ...segments) => path.resolve(path.dirname(basePath), ...segments),
  resolveChildPath: (basePath, ...segments) => path.resolve(basePath, ...segments)
}

const ordersPage = path.join(repoRoot, 'src', 'features', 'orders', 'page.tsx')
assert.equal(
  resolveTsImport(ordersPage, './service', projectContext),
  path.join(repoRoot, 'src/features/orders/service.ts')
)
assert.equal(
  resolveTsImport(ordersPage, '@/shared/button', projectContext),
  path.join(repoRoot, 'src/shared/button/index.tsx')
)
assert.equal(resolveTsImport(ordersPage, 'react', projectContext), null)
assert.equal(resolveTsImport(ordersPage, '@missing/file', projectContext), null)

const resolverFactories = [
  () =>
    createImportResolver({
      exists: () => true,
      extensions: ['.ts'],
      strategies: [{ id: 'fixture', resolveBase: () => path.join(repoRoot, 'fixture') }]
    }),
  () =>
    createImportResolver({
      exists: () => true,
      extensions: ['.ts'],
      strategies: [
        { id: 'skip', resolveBase: () => null },
        { id: 'fixture', resolveBase: () => path.join(repoRoot, 'fixture') }
      ]
    })
]
for (const factory of resolverFactories) {
  assert.equal(factory().resolve(ordersPage, './fixture', projectContext), path.join(repoRoot, 'fixture.ts'))
}

assert.throws(() => createImportResolver({ strategies: [], exists() {} }), /non-empty array/u)
assert.throws(
  () =>
    createImportResolver({
      exists() {},
      strategies: [
        { id: 'same', resolveBase() {} },
        { id: 'same', resolveBase() {} }
      ]
    }),
  /Duplicate ImportResolver/u
)
assert.throws(() => createImportResolver({ strategies: [{ id: 'one', resolveBase() {} }] }), /requires an exists/u)

console.log('import resolver contract tests passed')
