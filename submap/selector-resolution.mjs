import { SubmapError } from '#submap/errors.mjs'

export function resolveSeeds(graph, selectors) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const missingNodeIds = selectors.nodeIds.filter((id) => !nodeById.has(id))
  if (missingNodeIds.length) {
    throw new SubmapError(
      'SUBMAP_SEED_NOT_FOUND',
      'One or more explicit seed nodes were not found.',
      { nodeIds: missingNodeIds },
      3
    )
  }
  const ids = resolveSelectorNodeIds(graph.nodes, selectors)
  if (!ids.size) {
    throw new SubmapError('SUBMAP_NO_SEEDS', 'The selectors did not resolve any seed nodes.', { selectors }, 3)
  }
  return ids
}

export function resolveSelectorNodeIds(nodes, selector) {
  const ids = new Set(selector.nodeIds)
  for (const node of nodes) {
    if (selector.paths.some((pattern) => globMatches(pattern, node.path ?? ''))) {
      ids.add(node.id)
    }
    if (matchesAttributeQuery(node, selector)) {
      ids.add(node.id)
    }
  }
  return ids
}

export function globMatches(pattern, value) {
  const normalizedPattern = String(pattern).replaceAll('\\', '/')
  const normalizedValue = String(value).replaceAll('\\', '/')
  const escaped = normalizedPattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/::DOUBLE_STAR::/g, '.*')
  return new RegExp(`^${escaped}$`).test(normalizedValue)
}

function matchesAttributeQuery(node, selector) {
  const hasQuery = selector.modules.length || selector.layers.length || selector.types.length
  if (!hasQuery) {
    return false
  }
  return (
    (!selector.modules.length || selector.modules.includes(node.module)) &&
    (!selector.layers.length || selector.layers.includes(node.layer)) &&
    (!selector.types.length || selector.types.includes(node.type))
  )
}
