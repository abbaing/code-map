import { SubmapError } from '#submap/errors.mjs'
import { ACCESS_LEVELS, resolveSelectorNodeIds } from '#submap/selectors.mjs'

export const defaultSelectionStrategy = Object.freeze({
  id: 'selection.default',
  select({ nodes, selector }) {
    return resolveSelectorNodeIds(nodes, selector)
  }
})

export const defaultTraversalStrategy = Object.freeze({
  id: 'traversal.breadth-first',
  traverse({ seeds, edges, policy, excludedIds, blockedIds }) {
    const eligibleEdges = edges.filter((edge) => edgeAllowed(edge, policy))
    const adjacency = buildAdjacency(eligibleEdges, policy.direction)
    const includedIds = traverseBreadthFirst(seeds, adjacency, excludedIds, blockedIds, policy.maxDepth)
    return { eligibleEdges, includedIds }
  }
})

export const defaultAccessStrategy = Object.freeze({
  id: 'access.precedence',
  resolve({ nodes, rules, matches }) {
    const conflicts = [...matches.editable].filter((id) => matches.forbidden.has(id))
    if (conflicts.length) {
      throw new SubmapError(
        'SUBMAP_ACCESS_CONFLICT',
        'Nodes cannot be both editable and forbidden.',
        { nodeIds: conflicts.sort() },
        4
      )
    }

    const precedence = ['forbidden', 'generated', 'editable', 'readable', 'external']
    const resolved = Object.fromEntries(ACCESS_LEVELS.map((level) => [level, []]))
    for (const node of nodes) {
      const level = precedence.find((candidate) => matches[candidate].has(node.id)) ?? rules.default
      resolved[level].push(node.id)
    }
    for (const values of Object.values(resolved)) {
      values.sort()
    }
    return { default: rules.default, ...resolved }
  }
})

export function resolveSubmapStrategies(strategies = {}) {
  if (!strategies || typeof strategies !== 'object' || Array.isArray(strategies)) {
    throw new TypeError('Submap strategies must be an object.')
  }
  const resolved = Object.freeze({
    selection: strategies.selection ?? defaultSelectionStrategy,
    traversal: strategies.traversal ?? defaultTraversalStrategy,
    access: strategies.access ?? defaultAccessStrategy
  })
  assertStrategy(resolved.selection, 'selection', 'select')
  assertStrategy(resolved.traversal, 'traversal', 'traverse')
  assertStrategy(resolved.access, 'access', 'resolve')
  return resolved
}

export function selectNodeIds(strategy, nodes, selector, label = 'selection', knownNodes = nodes) {
  const result = strategy.select(Object.freeze({ nodes, selector }))
  const ids = assertIdSet(result, `${strategy.id ?? label} result`)
  const knownIds = new Set(knownNodes.map((node) => node.id))
  const unknownIds = [...ids].filter((id) => !knownIds.has(id))
  if (unknownIds.length > 0) {
    throw new TypeError(`${strategy.id ?? label} returned unknown node ids: ${unknownIds.sort().join(', ')}.`)
  }
  return ids
}

export function traverseNodeIds(strategy, input) {
  const result = strategy.traverse(Object.freeze(input))
  if (!result || !Array.isArray(result.eligibleEdges)) {
    throw new TypeError(`Traversal strategy ${strategy.id ?? '<anonymous>'} must return eligibleEdges.`)
  }
  return {
    eligibleEdges: result.eligibleEdges,
    includedIds: assertIdSet(result.includedIds, `${strategy.id ?? 'traversal'} includedIds`)
  }
}

export function resolveNodeAccess(strategy, input) {
  const result = strategy.resolve(Object.freeze(input))
  if (
    !result ||
    !ACCESS_LEVELS.includes(result.default) ||
    !ACCESS_LEVELS.every((level) => Array.isArray(result[level]) && result[level].every((id) => typeof id === 'string'))
  ) {
    throw new TypeError(`Access strategy ${strategy.id ?? '<anonymous>'} must return every access level.`)
  }

  const expectedIds = new Set(input.nodes.map((node) => node.id))
  const assignedIds = ACCESS_LEVELS.flatMap((level) => result[level])
  const unknownIds = assignedIds.filter((id) => !expectedIds.has(id))
  const duplicateIds = assignedIds.filter((id, index) => assignedIds.indexOf(id) !== index)
  const missingIds = [...expectedIds].filter((id) => !assignedIds.includes(id))
  if (unknownIds.length || duplicateIds.length || missingIds.length) {
    throw new TypeError(`Access strategy ${strategy.id ?? '<anonymous>'} must assign every included node exactly once.`)
  }

  return Object.fromEntries([
    ['default', result.default],
    ...ACCESS_LEVELS.map((level) => [level, [...result[level]].sort()])
  ])
}

function assertStrategy(strategy, kind, operation) {
  if (!strategy || typeof strategy[operation] !== 'function') {
    throw new TypeError(`Submap ${kind} strategy must implement ${operation}(input).`)
  }
}

function assertIdSet(value, label) {
  if (!(value instanceof Set) || [...value].some((id) => typeof id !== 'string')) {
    throw new TypeError(`${label} must be a Set of node ids.`)
  }
  return value
}

function traverseBreadthFirst(seeds, adjacency, excludedIds, blockedIds, maxDepth) {
  const included = new Set()
  const queue = [...seeds].sort().map((id) => ({ id, depth: 0 }))
  const bestDepth = new Map(queue.map((item) => [item.id, 0]))
  while (queue.length) {
    const current = queue.shift()
    if (excludedIds.has(current.id)) {
      continue
    }
    included.add(current.id)
    if (current.depth >= maxDepth || blockedIds.has(current.id)) {
      continue
    }
    for (const neighbor of adjacency.get(current.id) ?? []) {
      if (excludedIds.has(neighbor)) {
        continue
      }
      const depth = current.depth + 1
      if ((bestDepth.get(neighbor) ?? Infinity) <= depth) {
        continue
      }
      bestDepth.set(neighbor, depth)
      queue.push({ id: neighbor, depth })
    }
  }
  return included
}

function buildAdjacency(edges, direction) {
  const adjacency = new Map()
  const add = (from, to) => {
    const current = adjacency.get(from) ?? new Set()
    current.add(to)
    adjacency.set(from, current)
  }
  for (const edge of edges) {
    if (direction !== 'incoming') {
      add(edge.from, edge.to)
    }
    if (direction !== 'outgoing') {
      add(edge.to, edge.from)
    }
  }
  return new Map([...adjacency].map(([id, values]) => [id, [...values].sort()]))
}

function edgeAllowed(edge, traversal) {
  if (traversal.excludedEdgeTypes.includes(edge.type)) {
    return false
  }
  return traversal.edgeTypes.length === 0 || traversal.edgeTypes.includes(edge.type)
}
