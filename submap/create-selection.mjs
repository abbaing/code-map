import { assertExplicitNodeIdsExist, assertTraversalOutput } from '#submap/create-validation.mjs'
import { SubmapError } from '#submap/errors.mjs'
import { ACCESS_LEVELS } from '#submap/selectors.mjs'
import { selectNodeIds, traverseNodeIds } from '#submap/strategies.mjs'

export function resolveCreationSelection(graph, request, strategies) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  assertSelectorsExist(nodeById, request)
  const seeds = selectNodeIds(strategies.selection, graph.nodes, request.selectors, 'seed selection')
  assertSeeds(seeds, request.selectors)
  const excludedIds = selectNodeIds(strategies.selection, graph.nodes, request.exclusions, 'exclusions')
  const forbiddenIds = selectNodeIds(strategies.selection, graph.nodes, request.access.forbidden, 'forbidden access')
  assertNoSeedConflicts(seeds, excludedIds)
  const traversal = traverseNodeIds(strategies.traversal, {
    seeds,
    edges: graph.edges,
    policy: request.traversal,
    excludedIds,
    blockedIds: forbiddenIds
  })
  assertTraversalOutput(graph, nodeById, traversal.eligibleEdges, traversal.includedIds)
  return { ...traversal, seeds, excludedIds, nodeById }
}

function assertSelectorsExist(nodeById, request) {
  assertExplicitNodeIdsExist(nodeById, request.selectors, 'SUBMAP_SEED_NOT_FOUND')
  assertExplicitNodeIdsExist(nodeById, request.exclusions, 'SUBMAP_EXCLUSION_NODE_NOT_FOUND')
  for (const level of ACCESS_LEVELS) {
    assertExplicitNodeIdsExist(nodeById, request.access[level], 'SUBMAP_ACCESS_NODE_NOT_FOUND', { access: level })
  }
}

function assertSeeds(seeds, selectors) {
  if (!seeds.size) {
    throw new SubmapError('SUBMAP_NO_SEEDS', 'The selectors did not resolve any seed nodes.', { selectors }, 3)
  }
}

function assertNoSeedConflicts(seeds, excludedIds) {
  const conflicts = [...seeds].filter((id) => excludedIds.has(id))
  if (conflicts.length) {
    throw new SubmapError('SUBMAP_SEED_EXCLUDED', 'Explicit selection and exclusions resolve to the same node.', {
      nodeIds: conflicts.sort()
    })
  }
}
