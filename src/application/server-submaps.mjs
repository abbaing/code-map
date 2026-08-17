import path from 'node:path'
import { validateRevisionInput, validateSelectionInput, validateTraceInput } from '#app/server-input.mjs'
import { getStoredSubmap, listStoredSubmaps, submapsDirectory } from '#app/server-submap-storage.mjs'

export function createServerSubmapOperations(context) {
  return Object.freeze({
    listSubmaps: () => listStoredSubmaps(context),
    getSubmap: (uid) => getStoredSubmap(uid, context),
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
  const parent = getStoredSubmap(input.uid, context)
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
