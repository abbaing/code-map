import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { componentRoles, components, componentStatusValues } from '#architecture/components.mjs'
import { Graph } from '#core/graph.mjs'
import { ARCHITECTURE_RULES } from '#rules/architecture-guardrails.mjs'
import { RULES } from '#rules/frontend-guardrails.mjs'
import { templateCatalog } from '#templates/catalog.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const statuses = new Set(componentStatusValues)
const roles = new Set(componentRoles)
const designQualities = ['responsibility', 'extensibility', 'substitution', 'interfaces', 'dependencies']
const componentIds = new Set()
const ownedFiles = new Map()

for (const component of components) {
  assert.match(component.id, /^[a-z][a-z0-9-]*$/u, 'component ids must be stable kebab-case identifiers')
  assert.equal(componentIds.has(component.id), false, `duplicate component id: ${component.id}`)
  componentIds.add(component.id)
  assert.equal(typeof component.responsibility, 'string')
  assert.equal(component.responsibility.trim().length > 0, true, `${component.id} must state one responsibility`)
  assert.equal(roles.has(component.role), true, `${component.id} must declare a recognized architectural role`)
  assert.equal(typeof component.compositionRoot, 'boolean')
  assert.equal(component.compositionRoot, component.role === 'composition-root')
  assert.equal(Array.isArray(component.contracts) && component.contracts.length > 0, true)
  assert.equal(new Set(component.contracts).size, component.contracts.length, `${component.id} repeats a contract`)
  assert.equal(typeof component.decision, 'string')
  assert.equal(
    component.decision.trim().length > 0,
    true,
    `${component.id} must document its next architectural decision`
  )

  assert.deepEqual(Object.keys(component.design).sort(), designQualities.toSorted())
  for (const quality of designQualities) {
    const status = component.design[quality]
    assert.equal(statuses.has(status), true, `${component.id}.${quality} has an unknown status`)
    if (quality !== 'substitution') {
      assert.notEqual(status, 'not-applicable', `${quality} applies to every component`)
    }
  }
  if (component.design.substitution === 'pass') {
    assert.equal(component.contracts.length > 0, true, `${component.id} needs a substitution contract`)
  }

  assert.equal(Array.isArray(component.files) && component.files.length > 0, true, `${component.id} must own files`)
  for (const file of component.files) {
    assert.match(file, /\.(?:mjs|js)$/u, `${component.id} may only classify executable source files`)
    assert.equal(fs.existsSync(path.join(root, file)), true, `${component.id} references missing file ${file}`)
    assert.equal(ownedFiles.has(file), false, `${file} is owned by both ${ownedFiles.get(file)} and ${component.id}`)
    ownedFiles.set(file, component.id)
  }
}

const productionFiles = listProductionFiles(root)
assert.deepEqual(
  [...ownedFiles.keys()].sort(),
  productionFiles,
  'every production JavaScript module must belong to exactly one declared component'
)

const graph = new Graph()
for (const operation of ['addNode', 'addEdge', 'getNode', 'getEdge', 'hasNode', 'allNodes', 'allEdges', 'clear']) {
  assert.equal(typeof graph[operation], 'function', `Graph contract is missing ${operation}`)
}

assertUniqueContracts([...RULES, ...ARCHITECTURE_RULES], 'rule', (rule) => {
  assert.equal(typeof rule.check, 'function', `rule ${rule.id} must implement check(context)`)
  assert.equal(typeof rule.meta?.severity, 'string', `rule ${rule.id} must declare severity`)
})

const capabilityIds = {
  fileKind: new Set(),
  scanner: new Set(),
  enricher: new Set()
}
assertUniqueContracts(templateCatalog, 'template', (template) => {
  assert.equal(typeof template.description, 'string', `template ${template.id} must describe its capability`)
  for (const kind of template.capabilities?.fileKinds ?? []) {
    assert.match(kind.id, /\S/u, `template ${template.id} has a file kind without id`)
    assertUniqueCapability(capabilityIds.fileKind, kind.id, 'file kind')
  }
  for (const scanner of template.capabilities?.scanners ?? []) {
    assert.match(scanner.id, /\S/u, `template ${template.id} has a scanner without id`)
    assertUniqueCapability(capabilityIds.scanner, scanner.id, 'scanner')
    assert.equal(typeof scanner.run, 'function', `scanner ${scanner.id} must implement run(context)`)
    assert.equal(Array.isArray(scanner.requires), true, `scanner ${scanner.id} must declare required inputs`)
  }
  for (const enricher of template.capabilities?.enrichers ?? []) {
    assert.match(enricher.id, /\S/u, `template ${template.id} has an enricher without id`)
    assertUniqueCapability(capabilityIds.enricher, enricher.id, 'enricher')
    assert.equal(typeof enricher.run, 'function', `enricher ${enricher.id} must implement run(context)`)
    assert.equal(Array.isArray(enricher.requires), true, `enricher ${enricher.id} must declare required inputs`)
  }
})

console.log('component architecture contracts passed')

function listProductionFiles(directory) {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['.git', 'architecture', 'node_modules', 'tests'].includes(entry.name)) {
      continue
    }
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...listProductionFiles(target))
    } else if (/\.(?:mjs|js)$/u.test(entry.name) && entry.name !== 'eslint.config.js') {
      files.push(path.relative(root, target).replaceAll(path.sep, '/'))
    }
  }
  return files.sort()
}

function assertUniqueContracts(items, kind, inspect) {
  const ids = new Set()
  for (const item of items) {
    assert.match(item.id, /\S/u, `${kind} must declare an id`)
    assert.equal(ids.has(item.id), false, `duplicate ${kind} id: ${item.id}`)
    ids.add(item.id)
    inspect(item)
  }
}

function assertUniqueCapability(ids, id, kind) {
  assert.equal(ids.has(id), false, `duplicate ${kind} id: ${id}`)
  ids.add(id)
}
