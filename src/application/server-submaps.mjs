import path from 'node:path'
import { ApplicationNotFoundError } from '#app/server-contracts.mjs'
import {
  validateRevisionInput,
  validateSelectionInput,
  validateSubmapUid,
  validateTraceInput
} from '#app/server-input.mjs'

export function createServerSubmapOperations(context) {
  return Object.freeze({
    listSubmaps: () => listSubmaps(context),
    getSubmap: (uid) => getSubmap(uid, context),
    createSelectionSubmap: (input) => createSelectionSubmap(input, context),
    createTraceSubmap: (input) => createTraceSubmap(input, context),
    reviseSubmap: (input) => reviseSubmap(input, context)
  })
}

function createTraceSubmap(input, context) {
  validateTraceInput(input)
  return persistSubmap(traceRequest(input), context)
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

function reviseSubmap(input, context) {
  validateRevisionInput(input)
  const parent = getSubmap(input.uid, context)
  return persistSubmap(
    {
      id: parent.id,
      revision: parent.revision + 1,
      parentUid: parent.uid,
      selectors: { nodeIds: [...new Set(input.nodeIds)] },
      traversal: { direction: 'both', maxDepth: 0 },
      metadata: revisionMetadata(parent)
    },
    context
  )
}

function revisionMetadata(parent) {
  return {
    ...parent.metadata,
    kind: 'selection',
    name: parent.metadata?.name ?? parent.id,
    ...(parent.metadata?.kind && parent.metadata.kind !== 'selection' ? { derivedFromKind: parent.metadata.kind } : {})
  }
}

function persistSubmap(request, { state, paths, services, fileSystem, root }) {
  const project = state.context
  paths.assertProjectMapPaths(project.projectMap, project.configPath)
  const graphPath = paths.projectPath(project.resolveGraphOutputPath(), 'project.graphOutput')
  const graph = JSON.parse(fileSystem.readText(graphPath))
  const submap = services.submaps.create(graph, request)
  const directory = submapsDirectory(project, paths, root)
  const output = path.join(directory, services.submaps.filename(submap))
  services.submaps.write(output, submap)
  return {
    file: path.relative(root, output),
    uid: submap.uid,
    revision: submap.revision,
    statistics: submap.statistics
  }
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
    id: submap.id,
    name: submap.metadata?.name ?? submap.id,
    uid: submap.uid,
    revision: submap.revision,
    parentUid: submap.parentUid,
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
