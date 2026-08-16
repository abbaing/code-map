import path from 'node:path'
import {
  ApplicationInputError,
  ApplicationNotFoundError,
  assertServerApplicationServices
} from '#app/server-contracts.mjs'
import {
  assertPluginConfigurationUnchanged,
  createProjectPathPolicy,
  validateSelectionInput,
  validateSubmapUid,
  validateTraceInput
} from '#app/server-input.mjs'

export {
  ApplicationInputError,
  ApplicationNotFoundError,
  assertServerApplication,
  assertServerApplicationServices,
  serverApplicationContract,
  serverApplicationServicesContract
} from '#app/server-contracts.mjs'

export function createServerApplication({ projectContext, repoRoot, services: providedServices } = {}) {
  if (!projectContext) {
    throw new TypeError('createServerApplication requires a ProjectContext.')
  }
  const services = assertServerApplicationServices(providedServices)
  const root = repoRoot ?? projectContext.repoRoot
  const fileSystem = projectContext.platform.fileSystem
  const paths = createProjectPathPolicy(root, fileSystem)
  let context = projectContext
  const state = {
    get context() {
      return context
    },
    set context(value) {
      context = value
    }
  }

  function scan() {
    paths.assertProjectMapPaths(context.projectMap, context.configPath)
    const output = paths.projectPath(context.resolveGraphOutputPath(), 'project.graphOutput')
    return services.scanner.scan(output, context)
  }

  function saveProjectMap(input) {
    const projectMapPath = context.configPath
    if (!projectMapPath) {
      throw new ApplicationInputError(
        'Cannot save an auto-detected project map. Export the config or restart code-map with --config <path>.'
      )
    }
    paths.projectPath(projectMapPath, 'Project map')
    const document = validateProjectMapUpdate(input, projectMapPath, context, services, root)
    paths.assertProjectMapPaths(document, projectMapPath)
    assertPluginConfigurationUnchanged(document, context.projectMap)
    const previousDocument = fileSystem.readText(projectMapPath)
    services.projectMaps.write(projectMapPath, document)
    try {
      context = services.projectMaps.load(projectMapPath, { repoRoot: root, platform: projectContext.platform })
      return { projectMap: context.projectMap, stats: scan().stats }
    } catch (error) {
      context = rollbackProjectMap({ error, projectMapPath, previousDocument, context, services, repoRoot: root })
      throw error
    }
  }

  return Object.freeze({
    graphPath: () => paths.projectPath(context.resolveGraphOutputPath(), 'project.graphOutput'),
    projectMap: () => context.projectMap,
    scan,
    saveProjectMap,
    listSubmaps: () => listSubmaps({ state, paths, services, root }),
    getSubmap: (uid) => getSubmap(uid, { state, paths, services, root }),
    createSelectionSubmap: (input) => createSelectionSubmap(input, { state, paths, services, fileSystem, root }),
    createTraceSubmap: (input) => createTraceSubmap(input, { state, paths, services, fileSystem, root })
  })
}

function validateProjectMapUpdate(input, projectMapPath, context, services, repoRoot) {
  try {
    services.projectMaps.validate(input, projectMapPath, { repoRoot })
    const document = structuredClone(input)
    delete document.configPath
    return document
  } catch (error) {
    throw new ApplicationInputError(error.message, { cause: error })
  }
}

function rollbackProjectMap({ error, projectMapPath, previousDocument, context, services, repoRoot }) {
  try {
    services.projectMaps.restore(projectMapPath, previousDocument)
    return services.projectMaps.load(projectMapPath, { repoRoot, platform: context.platform })
  } catch (rollbackError) {
    throw new AggregateError([error, rollbackError], 'Project map update and rollback both failed.')
  }
}

function createTraceSubmap(input, { state, paths, services, fileSystem, root }) {
  validateTraceInput(input)
  return persistSubmap(traceRequest(input), { state, paths, services, fileSystem, root })
}

function createSelectionSubmap(input, context) {
  validateSelectionInput(input)
  const name = input.name.trim()
  return persistSubmap(
    {
      id: selectionId(name),
      selectors: { nodeIds: [...new Set(input.nodeIds)] },
      traversal: { direction: 'both', maxDepth: 0 },
      metadata: { kind: 'selection', name }
    },
    context
  )
}

function persistSubmap(request, { state, paths, services, fileSystem, root }) {
  const context = state.context
  paths.assertProjectMapPaths(context.projectMap, context.configPath)
  const graphPath = paths.projectPath(context.resolveGraphOutputPath(), 'project.graphOutput')
  const graph = JSON.parse(fileSystem.readText(graphPath))
  const submap = services.submaps.create(graph, request)
  const directory = submapsDirectory(context, paths, root)
  const output = path.join(directory, services.submaps.filename(submap))
  services.submaps.write(output, submap)
  return { file: path.relative(root, output), uid: submap.uid, statistics: submap.statistics }
}

function selectionId(name) {
  const id = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9._-]+/giu, '-')
    .replace(/^-+|-+$/gu, '')
    .toLowerCase()
  return /^[a-z0-9]/u.test(id)
    ? id
    : `selection-${[...name].map((character) => character.codePointAt(0).toString(36)).join('-')}`
}

function listSubmaps({ state, paths, services, root }) {
  const directory = submapsDirectory(state.context, paths, root)
  return services.submaps
    .list(directory)
    .map((filePath) => submapSummary(services.submaps.read(filePath), filePath))
    .sort((left, right) => left.name.localeCompare(right.name) || right.revision - left.revision)
}

function getSubmap(uid, { state, paths, services, root }) {
  validateSubmapUid(uid)
  const directory = submapsDirectory(state.context, paths, root)
  for (const filePath of services.submaps.list(directory)) {
    const submap = services.submaps.read(filePath)
    if (submap.uid === uid) {
      return submap
    }
  }
  throw new ApplicationNotFoundError('Submap not found.')
}

function submapSummary(submap, filePath) {
  return {
    name: submap.metadata?.name ?? submap.id,
    uid: submap.uid,
    revision: submap.revision,
    createdAt: submap.createdAt,
    projectName: submap.source?.projectName,
    statistics: submap.statistics,
    kind: submap.metadata?.kind ?? 'selection',
    file: path.basename(filePath)
  }
}

function submapsDirectory(context, paths, root) {
  return paths.projectPath(
    path.resolve(root, context.projectMap.project.submapsDirectory ?? '.code-map/submaps'),
    'project.submapsDirectory'
  )
}

function traceRequest(input) {
  return {
    id: input.id,
    selectors: { nodeIds: [...new Set(input.nodeIds)] },
    traversal: { direction: 'both', maxDepth: 0 },
    metadata: {
      kind: 'execution-trace',
      selectedNodeId: input.selectedNodeId,
      complete: Boolean(input.complete),
      traceEdgeIds: Array.isArray(input.edgeIds) ? [...new Set(input.edgeIds)] : []
    }
  }
}
