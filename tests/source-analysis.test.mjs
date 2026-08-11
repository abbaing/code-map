import assert from 'node:assert/strict'
import {
  componentContainerDirs,
  displayLabel,
  escapeRegExp,
  findComponentDirIndex,
  isBackTestFile,
  kebab,
  normalizePath
} from '#core/source-analysis.mjs'
import { importsOf, isTestFile, moduleReferencesOf, stripTsComments, tsExtensions } from '#parsers/typescript.mjs'
import { stripCSharpComments, stripCSharpStringLiterals } from '#parsers/csharp.mjs'
import {
  SourceFileTooLargeError,
  createSourceReader,
  normalizePath as compatibleNormalizePath,
  walk
} from '#core/scan-utils.mjs'

assert.equal(normalizePath('src\\features\\orders\\index.ts'), 'src/features/orders/index.ts')
assert.equal(displayLabel('src/features/orders/index.ts'), 'orders')
assert.equal(displayLabel('src/features/orders/service.ts'), 'service.ts')
assert.equal(displayLabel('index.ts'), 'index.ts')
assert.equal(isTestFile('src/order.spec.tsx'), true)
assert.equal(isTestFile('src/order.tsx'), false)
assert.equal(isBackTestFile('src/Demo.Tests/OrderTests.cs'), true)
assert.equal(isBackTestFile('src\\Demo.Tests\\OrderTests.cs'), true)
assert.equal(findComponentDirIndex(['src', 'pages', 'home', 'components', 'card']), 3)
assert.equal(kebab('OrderHistory_View'), 'order-history-view')
assert.equal(escapeRegExp('orders[0].id'), 'orders\\[0\\]\\.id')
assert.equal(Object.isFrozen(tsExtensions), true)

const requestedFiles = []
const sourceReader = createSourceReader(
  {
    stat: (filePath) => ({ size: filePath === 'large.ts' ? 11 : 4 }),
    readText(filePath) {
      requestedFiles.push(filePath)
      return 'text'
    }
  },
  (filePath) => `source/${filePath}`,
  10
)
assert.equal(sourceReader.readText('small.ts'), 'text')
assert.deepEqual(requestedFiles, ['small.ts'])
assert.throws(
  () => sourceReader.readText('large.ts'),
  (error) => error instanceof SourceFileTooLargeError && error.message.includes('source/large.ts')
)
assert.throws(() => createSourceReader({ stat() {} }), /requires stat and readText/u)

const sourceEntries = new Map([
  ['/source', [directoryEntry('nested'), fileEntry('z.ts'), fileEntry('ignored.js')]],
  ['/source/nested', [fileEntry('a.ts'), fileEntry('large.ts')]]
])
const skippedFiles = []
const walkedFiles = walk('/source', (filePath) => filePath.endsWith('.ts'), {
  fileSystem: {
    exists: (filePath) => sourceEntries.has(filePath),
    readDirectory: (directory) => sourceEntries.get(directory),
    stat: (filePath) => ({ size: filePath.endsWith('large.ts') ? 11 : 4 })
  },
  resolveChildPath: (directory, name) => `${directory}/${name}`,
  maxFileBytes: 10,
  onSkippedFile: (file) => skippedFiles.push(file),
  toRepoPath: (filePath) => filePath
})
assert.deepEqual(walkedFiles, ['/source/nested/a.ts', '/source/z.ts'])
assert.deepEqual(skippedFiles, [{ filePath: '/source/nested/large.ts', size: 11, limit: 10 }])
assert.throws(() => walk('/source', () => true), /requires exists, readDirectory, and stat/u)
assert.throws(
  () =>
    walk('/source', () => true, {
      fileSystem: { exists() {}, readDirectory() {}, stat() {} }
    }),
  /requires a child path resolver/u
)
assert.equal(Object.isFrozen(componentContainerDirs), true)
assert.equal(compatibleNormalizePath, normalizePath)

const typeScriptSource = `
// import ignored from './ignored.js'
import value from './value.js'
/* export { hidden } from './hidden.js' */
export { item } from './item.js'
const url = 'https://example.test/path'
`
assert.deepEqual(
  importsOf(typeScriptSource).map(({ specifier }) => specifier),
  ['./value.js', './item.js']
)
assert.deepEqual(moduleReferencesOf(typeScriptSource), [
  { specifier: './value.js', index: typeScriptSource.indexOf('import value'), kind: 'static' },
  { specifier: './item.js', index: typeScriptSource.indexOf('export { item }'), kind: 'static' }
])

const lazySource = `
const example = "import('./string.js')"
// import('./comment.js')
const lazy = import(\`./lazy.js\`)
const computed = import('./features/' + name)
`
assert.deepEqual(moduleReferencesOf(lazySource, 'lazy.tsx'), [
  { specifier: './lazy.js', index: lazySource.indexOf('import(`'), kind: 'dynamic' }
])
assert.match(stripTsComments(typeScriptSource), /https:\/\/example\.test/u)
assert.doesNotMatch(stripTsComments(typeScriptSource), /ignored/u)

const csharpSource = `
// new IgnoredCommand();
var url = "https://example.test/path";
var interpolated = $"new {name} Command";
/* new HiddenQuery(); */
new VisibleCommand();
`
const withoutStrings = stripCSharpStringLiterals(csharpSource)
assert.doesNotMatch(withoutStrings, /example\.test|new \{name\} Command/u)
const withoutComments = stripCSharpComments(csharpSource)
assert.doesNotMatch(withoutComments, /IgnoredCommand|HiddenQuery/u)
assert.match(withoutComments, /VisibleCommand/u)

console.log('source analysis tests passed')

function directoryEntry(name) {
  return { name, isDirectory: () => true, isFile: () => false }
}

function fileEntry(name) {
  return { name, isDirectory: () => false, isFile: () => true }
}
