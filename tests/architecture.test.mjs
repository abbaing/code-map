import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { allowedDependencyRoles, dependencyEdge } from '#architecture/dependency-policy.mjs'
import { components } from '#architecture/components.mjs'
import {
  findCycles,
  importSpecifiers,
  listSourceFiles,
  localDependencies,
  relativePath
} from '#tests/architecture-support.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const relative = (file) => relativePath(file, root)
const productionFiles = listSourceFiles(root)
const dependencies = new Map(productionFiles.map((file) => [file, localDependencies(file, root)]))
const componentByFile = new Map(
  components.flatMap((component) => component.files.map((file) => [path.join(root, file), component]))
)
const testFiles = fs
  .readdirSync(path.join(root, 'tests'), { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.mjs'))
  .map((entry) => path.join(root, 'tests', entry.name))

for (const file of testFiles) {
  const specifiers = importSpecifiers(fs.readFileSync(file, 'utf8'))
  assert.equal(
    specifiers.some((specifier) => specifier.endsWith('.test.mjs')),
    false,
    `${relative(file)} must not import an executable test suite`
  )
}

for (const file of productionFiles) {
  const specifiers = importSpecifiers(fs.readFileSync(file, 'utf8'))
  assert.equal(
    specifiers.some((specifier) => /^\.{1,2}\//u.test(specifier)),
    false,
    `${relative(file)} must use a scoped module alias instead of a relative import`
  )
}

for (const [file, imports] of dependencies) {
  assert.equal(
    imports.some((target) => target.includes(`${path.sep}tests${path.sep}`)),
    false,
    `${relative(file)} must not import tests`
  )
}

for (const [source, targets] of dependencies) {
  const sourceComponent = componentByFile.get(source)
  assert.ok(sourceComponent, `${relative(source)} must have a component owner`)
  const allowedRoles = new Set(allowedDependencyRoles[sourceComponent.role])
  assert.equal(allowedRoles.size > 0, true, `${sourceComponent.role} must define allowed dependency roles`)

  for (const target of targets) {
    const targetComponent = componentByFile.get(target)
    assert.ok(targetComponent, `${relative(target)} must have a component owner`)
    if (sourceComponent.language && targetComponent.language && sourceComponent.language !== targetComponent.language) {
      assert.fail(
        `${relative(source)} (${sourceComponent.language}) must not import ${relative(target)} (${targetComponent.language})`
      )
    }
    if (sourceComponent.id === targetComponent.id || allowedRoles.has(targetComponent.role)) {
      continue
    }
    const edge = dependencyEdge(relative(source), relative(target))
    assert.fail(`${edge} violates component dependency direction`)
  }
}

for (const file of productionFiles.filter((candidate) => relative(candidate).startsWith('viewer/'))) {
  const specifiers = importSpecifiers(fs.readFileSync(file, 'utf8'))
  assert.equal(
    specifiers.some((specifier) => specifier.startsWith('node:')),
    false,
    `${relative(file)} must remain browser-runtime independent`
  )
  assert.equal(
    dependencies.get(file).some((target) => !relative(target).startsWith('viewer/')),
    false,
    `${relative(file)} must not reach into server modules`
  )
}

const coreFiles = productionFiles.filter((file) => {
  const name = relative(file)
  return (
    name.startsWith('src/core/') ||
    name.startsWith('rules/') ||
    name.startsWith('templates/') ||
    /^submap\/(?:create|diff|digest|errors|selectors|validate|index)\.mjs$/u.test(name)
  )
})
for (const file of coreFiles) {
  const imports = dependencies.get(file).map(relative)
  assert.equal(
    imports.some(
      (target) =>
        target === 'cli.mjs' ||
        target === 'server.mjs' ||
        target === 'src/application/server-app.mjs' ||
        target.startsWith('viewer/')
    ),
    false,
    `${relative(file)} must not depend on delivery adapters`
  )
}

const scannerFiles = components
  .flatMap((component) => component.files)
  .filter((file) => file.startsWith('src/scanners/'))
for (const scannerFile of scannerFiles) {
  const source = fs.readFileSync(path.join(root, scannerFile), 'utf8')
  assert.equal(
    importSpecifiers(source).some((specifier) => specifier.startsWith('#parsers/')),
    false,
    `${scannerFile} must consume registered source facts instead of importing a language parser`
  )
  assert.doesNotMatch(source, /\.syntax\b/u, `${scannerFile} must treat parsed syntax as opaque`)
}

const graphSource = fs.readFileSync(path.join(root, 'src/core/graph-model.mjs'), 'utf8')
assert.deepEqual(
  importSpecifiers(graphSource),
  [],
  'Graph must remain independent from configuration, filesystems, CLI, and HTTP'
)

const serverSource = fs.readFileSync(path.join(root, 'server.mjs'), 'utf8')
assert.match(serverSource, /from '#app\/server-app\.mjs'/u, 'the HTTP adapter must delegate use cases to server-app')
assert.doesNotMatch(
  fs.readFileSync(path.join(root, 'src/application/server-app.mjs'), 'utf8'),
  /node:http/u,
  'application use cases must not depend on HTTP'
)
assert.deepEqual(
  importSpecifiers(fs.readFileSync(path.join(root, 'submap/cli-args.mjs'), 'utf8')),
  ['#submap/errors.mjs'],
  'the CLI parser must depend only on the error contract'
)

assert.deepEqual(findCycles(dependencies, root), [], 'production module dependencies must remain acyclic')

console.log('architecture guardrails passed')
