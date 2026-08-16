import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const originalCwd = process.cwd()
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'code-map-server-app-'))

try {
  process.chdir(tempRoot)
  fs.mkdirSync(path.join(tempRoot, 'src'), { recursive: true })
  fs.writeFileSync(path.join(tempRoot, 'src', 'index.js'), 'export const answer = 42\n', 'utf8')

  const configPath = path.join(tempRoot, 'project-map.json')
  const config = {
    schemaVersion: 1,
    project: {
      name: 'Server Application Fixture',
      graphOutput: '.code-map/graph.json',
      submapsDirectory: '.code-map/submaps'
    },
    sourceRoots: { frontend: 'src' },
    templates: { enabled: ['filesystem', 'typescript', 'react'] },
    imports: { aliases: [] },
    modules: { shared: 'shared', labels: {} },
    layers: [{ id: 'auxiliary', label: 'Auxiliary' }],
    frontend: { entryPoints: [], classifiers: [], coverableTypes: [] },
    rules: { enabled: [], options: {}, suppressions: [] }
  }
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')

  const { loadProjectContext } = await import('#core/config.mjs')
  const { nodePlatform } = await import('#platform/node.mjs')
  const {
    ApplicationInputError,
    assertServerApplication,
    assertServerApplicationServices,
    createServerApplication,
    serverApplicationContract,
    serverApplicationServicesContract
  } = await import('#app/server-app.mjs')
  const { nodeServerApplicationServices } = await import('#node/server-app-node.mjs')

  const projectContext = loadProjectContext(configPath, { repoRoot: tempRoot, platform: nodePlatform })
  const delegatedCalls = []
  const delegatedServices = delegateServices(nodeServerApplicationServices, delegatedCalls)
  assert.equal(assertServerApplicationServices(nodeServerApplicationServices), nodeServerApplicationServices)
  assert.equal(assertServerApplicationServices(delegatedServices), delegatedServices)
  assert.deepEqual(serverApplicationServicesContract, {
    scanner: ['scan'],
    projectMaps: ['validate', 'load', 'write', 'restore'],
    submaps: ['create', 'filename', 'list', 'read', 'write']
  })
  const application = createServerApplication({ projectContext, services: delegatedServices })
  assert.equal(Object.isFrozen(application), true)
  assert.equal(assertServerApplication(application), application)
  assert.deepEqual(serverApplicationContract, [
    'graphPath',
    'projectMap',
    'scan',
    'saveProjectMap',
    'listSubmaps',
    'createSelectionSubmap',
    'createTraceSubmap'
  ])
  const graphPath = path.join(tempRoot, '.code-map', 'graph.json')
  assert.equal(application.graphPath(), graphPath)
  assert.equal(application.projectMap().project.name, config.project.name)

  const graph = application.scan()
  assert.equal(fs.existsSync(graphPath), true, 'scanning through the application service must persist the graph')
  assert.equal(graph.stats.nodes > 0, true)

  const selectedNodeId = graph.nodes[0].id
  const selectionResult = application.createSelectionSubmap({ name: 'Payment flow', nodeIds: [selectedNodeId] })
  const selection = JSON.parse(fs.readFileSync(path.join(tempRoot, selectionResult.file), 'utf8'))
  assert.equal(selection.id, 'payment-flow')
  assert.deepEqual(selection.metadata, { kind: 'selection', name: 'Payment flow' })
  const traceResult = application.createTraceSubmap({
    id: 'direct-trace',
    nodeIds: [selectedNodeId, selectedNodeId],
    edgeIds: [],
    selectedNodeId,
    complete: true
  })
  assert.match(
    traceResult.file.replaceAll(path.sep, '/'),
    /^\.code-map\/submaps\/direct-trace@[a-f0-9]{8}\.submap\.json$/u
  )
  assert.equal(traceResult.statistics.nodes, 1)
  const trace = JSON.parse(fs.readFileSync(path.join(tempRoot, traceResult.file), 'utf8'))
  assert.deepEqual(
    trace.nodes.map((node) => node.id),
    [selectedNodeId]
  )
  assert.deepEqual(trace.metadata, {
    kind: 'execution-trace',
    selectedNodeId,
    complete: true,
    traceEdgeIds: []
  })
  const listedSubmaps = application.listSubmaps()
  assert.deepEqual(
    listedSubmaps.map(({ name }) => name),
    ['direct-trace', 'Payment flow']
  )

  for (const [input, message] of [
    [null, /Trace request must be a JSON object/u],
    [{ id: 'trace', nodeIds: [selectedNodeId], extra: true }, /Unknown trace request properties: extra/u],
    [{ id: 'trace', nodeIds: [] }, /non-empty trace selection/u],
    [{ id: 'trace', nodeIds: [''] }, /nodeIds must be an array of non-empty strings/u],
    [{ id: 'invalid trace', nodeIds: [selectedNodeId] }, /Trace id must use/u],
    [{ id: 'trace', nodeIds: [selectedNodeId], selectedNodeId: '' }, /selectedNodeId must be/u],
    [{ id: 'trace', nodeIds: [selectedNodeId], complete: 'yes' }, /complete must be a boolean/u]
  ]) {
    assert.throws(
      () => application.createTraceSubmap(input),
      (error) => error instanceof ApplicationInputError && message.test(error.message)
    )
  }

  const changedConfig = structuredClone(config)
  changedConfig.project.name = 'Updated Server Application Fixture'
  const saveResult = application.saveProjectMap(changedConfig)
  assert.equal(saveResult.projectMap.project.name, changedConfig.project.name)
  assert.equal(saveResult.stats.nodes > 0, true)
  assert.equal(JSON.parse(fs.readFileSync(configPath, 'utf8')).project.name, changedConfig.project.name)

  const changedPlugins = structuredClone(changedConfig)
  changedPlugins.templates.plugins = ['./unreviewed-plugin.mjs']
  assert.throws(
    () => application.saveProjectMap(changedPlugins),
    (error) => error instanceof ApplicationInputError && /Template plugins cannot be changed/u.test(error.message)
  )

  const autoDetectedContext = loadProjectContext(changedConfig, { repoRoot: tempRoot, platform: nodePlatform })
  const autoDetectedApplication = createServerApplication({
    projectContext: autoDetectedContext,
    services: delegatedServices
  })
  assert.throws(
    () => autoDetectedApplication.saveProjectMap(changedConfig),
    (error) => error instanceof ApplicationInputError && /Cannot save an auto-detected project map/u.test(error.message)
  )
  assert.deepEqual(
    new Set(delegatedCalls),
    new Set([
      'scanner.scan',
      'projectMaps.validate',
      'projectMaps.load',
      'projectMaps.write',
      'submaps.create',
      'submaps.filename',
      'submaps.list',
      'submaps.read',
      'submaps.write'
    ])
  )
  assert.throws(() => createServerApplication({ projectContext }), /services are required/u)
  assert.throws(() => assertServerApplication({}), /must implement graphPath/u)
} finally {
  process.chdir(originalCwd)
  fs.rmSync(tempRoot, { recursive: true, force: true })
}

console.log('server application tests passed')

function delegateServices(services, calls) {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(services).map(([capability, implementation]) => [
        capability,
        Object.freeze(
          Object.fromEntries(
            Object.entries(implementation).map(([operation, execute]) => [
              operation,
              (...args) => {
                calls.push(`${capability}.${operation}`)
                return execute(...args)
              }
            ])
          )
        )
      ])
    )
  )
}
