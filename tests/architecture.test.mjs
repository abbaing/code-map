import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { allowedDependencyRoles, dependencyEdge, legacyDependencyEdges } from '../architecture/dependency-policy.mjs'
import { components } from '../architecture/components.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const productionFiles = listSourceFiles(root)
const dependencies = new Map(productionFiles.map((file) => [file, localDependencies(file)]))
const componentByFile = new Map(
  components.flatMap((component) => component.files.map((file) => [path.join(root, file), component]))
)

for (const [file, imports] of dependencies) {
  assert.equal(
    imports.some((target) => target.includes(`${path.sep}tests${path.sep}`)),
    false,
    `${relative(file)} must not import tests`
  )
}

const observedLegacyEdges = new Set()
const approvedLegacyEdges = new Set(legacyDependencyEdges)
assert.equal(approvedLegacyEdges.size, legacyDependencyEdges.length, 'legacy dependency edges must be unique')
for (const [source, targets] of dependencies) {
  const sourceComponent = componentByFile.get(source)
  assert.ok(sourceComponent, `${relative(source)} must have a component owner`)
  const allowedRoles = new Set(allowedDependencyRoles[sourceComponent.role])
  assert.equal(allowedRoles.size > 0, true, `${sourceComponent.role} must define allowed dependency roles`)

  for (const target of targets) {
    const targetComponent = componentByFile.get(target)
    assert.ok(targetComponent, `${relative(target)} must have a component owner`)
    if (sourceComponent.id === targetComponent.id || allowedRoles.has(targetComponent.role)) {
      continue
    }
    const edge = dependencyEdge(relative(source), relative(target))
    assert.equal(approvedLegacyEdges.has(edge), true, `${edge} violates component dependency direction`)
    observedLegacyEdges.add(edge)
  }
}
assert.deepEqual(
  [...observedLegacyEdges].sort(),
  [...approvedLegacyEdges].sort(),
  'legacy dependency exceptions must describe current production edges exactly'
)

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
    name === 'graph.mjs' ||
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
        target === 'cli.mjs' || target === 'server.mjs' || target === 'server-app.mjs' || target.startsWith('viewer/')
    ),
    false,
    `${relative(file)} must not depend on delivery adapters`
  )
}

const graphSource = fs.readFileSync(path.join(root, 'graph.mjs'), 'utf8')
assert.deepEqual(
  importSpecifiers(graphSource),
  [],
  'Graph must remain independent from configuration, filesystems, CLI, and HTTP'
)

const serverSource = fs.readFileSync(path.join(root, 'server.mjs'), 'utf8')
assert.match(serverSource, /from '\.\/server-app\.mjs'/u, 'the HTTP adapter must delegate use cases to server-app')
assert.doesNotMatch(
  fs.readFileSync(path.join(root, 'server-app.mjs'), 'utf8'),
  /node:http/u,
  'application use cases must not depend on HTTP'
)
assert.deepEqual(
  importSpecifiers(fs.readFileSync(path.join(root, 'submap/cli-args.mjs'), 'utf8')),
  ['./errors.mjs'],
  'the CLI parser must depend only on the error contract'
)

assert.deepEqual(findCycles(dependencies), [], 'production module dependencies must remain acyclic')

console.log('architecture guardrails passed')

function listSourceFiles(directory) {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['.git', 'architecture', 'node_modules', 'tests'].includes(entry.name)) {
      continue
    }
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(target))
    } else if (/\.(?:mjs|js)$/u.test(entry.name) && entry.name !== 'eslint.config.js') {
      files.push(target)
    }
  }
  return files.sort()
}

function importSpecifiers(source) {
  return [...source.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g)].map((match) => match[2])
}

function localDependencies(file) {
  return importSpecifiers(fs.readFileSync(file, 'utf8'))
    .filter((specifier) => specifier.startsWith('.'))
    .map((specifier) => {
      const resolved = path.resolve(path.dirname(file), specifier)
      return path.extname(resolved) ? resolved : `${resolved}.mjs`
    })
    .filter((target) => fs.existsSync(target))
}

function findCycles(graph) {
  const cycles = []
  const visited = new Set()
  const active = []
  const activeSet = new Set()
  for (const node of graph.keys()) {
    visit(node)
  }
  return cycles

  function visit(node) {
    if (activeSet.has(node)) {
      const start = active.indexOf(node)
      cycles.push([...active.slice(start), node].map(relative))
      return
    }
    if (visited.has(node)) {
      return
    }
    visited.add(node)
    active.push(node)
    activeSet.add(node)
    for (const target of graph.get(node) ?? []) {
      visit(target)
    }
    active.pop()
    activeSet.delete(node)
  }
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, '/')
}
