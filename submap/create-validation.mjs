import { validateGraphDocument } from '#core/graph.mjs'
import { SubmapError } from '#submap/errors.mjs'

export function assertGraph(graph) {
  try {
    validateGraphDocument(graph)
  } catch (error) {
    throw new SubmapError(
      'SUBMAP_INVALID_GRAPH',
      'A valid code-map graph document is required.',
      { issues: error.issues ?? [error.message] },
      4
    )
  }
}

export function assertExplicitNodeIdsExist(nodeById, selector, code, details = {}) {
  const missing = selector.nodeIds.filter((id) => !nodeById.has(id))
  if (missing.length) {
    throw new SubmapError(
      code,
      'An explicit selector references nodes absent from the source graph.',
      { ...details, nodeIds: missing },
      3
    )
  }
}

export function assertTraversalOutput(graph, nodeById, eligibleEdges, includedIds) {
  assertKnownNodes(nodeById, includedIds)
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]))
  const returnedEdgeIds = eligibleEdges.map((edge) => edge?.id)
  assertEdgeIds(returnedEdgeIds, edgeById)
  const changedEdgeIds = eligibleEdges.filter((edge) => changedEdge(edge, edgeById.get(edge.id))).map((edge) => edge.id)
  if (changedEdgeIds.length) {
    throw new TypeError(`Traversal strategy changed graph edges: ${changedEdgeIds.sort().join(', ')}.`)
  }
}

function assertKnownNodes(nodeById, includedIds) {
  const unknown = [...includedIds].filter((id) => !nodeById.has(id))
  if (unknown.length) {
    throw new TypeError(`Traversal strategy returned unknown node ids: ${unknown.sort().join(', ')}.`)
  }
}

function assertEdgeIds(ids, edgeById) {
  if (ids.some((id) => typeof id !== 'string')) {
    throw new TypeError('Traversal strategy returned an invalid edge.')
  }
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
  if (duplicates.length) {
    throw new TypeError(`Traversal strategy returned duplicate edges: ${[...new Set(duplicates)].sort().join(', ')}.`)
  }
  const unknown = ids.filter((id) => !edgeById.has(id))
  if (unknown.length) {
    throw new TypeError(`Traversal strategy returned unknown edges: ${unknown.sort().join(', ')}.`)
  }
}

function changedEdge(edge, source) {
  return edge.from !== source.from || edge.to !== source.to || edge.type !== source.type
}
