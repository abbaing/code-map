import { isFrontendOrigin, isPersistenceTarget } from '#viewer/viewer-trace-policy.js'

export function adjacencyFor(edges, direction) {
  const result = new Map()
  for (const edge of edges) {
    const from = direction === 'outgoing' ? edge.from : edge.to
    const to = direction === 'outgoing' ? edge.to : edge.from
    const bucket = result.get(from) ?? []
    bucket.push({ nodeId: to, edge })
    result.set(from, bucket)
  }
  return result
}

export function allTraceNodeIds(selectedId, outgoing, incoming, nodeById, entryPoints) {
  const forward = boundedReachable(selectedId, outgoing)
  const backward = boundedReachable(selectedId, incoming)
  let persistence = new Set([...forward].filter((id) => isPersistenceTarget(nodeById.get(id))))
  if (persistence.size === 0) {
    persistence = new Set([...forward].filter((id) => nodeById.get(id)?.type === 'entity'))
  }
  const origins = new Set([...backward].filter((id) => isFrontendOrigin(nodeById.get(id), entryPoints)))
  const canReachPersistence = reverseReachableFrom(persistence, incoming)
  const reachableFromOrigin = reverseReachableFrom(origins, outgoing)
  return intersectionPaths(selectedId, forward, backward, canReachPersistence, reachableFromOrigin)
}

export function boundedReachable(startId, adjacency, maxDepth = 28) {
  const seen = new Set([startId])
  const queue = [{ id: startId, depth: 0 }]
  while (queue.length) {
    const current = queue.shift()
    if (current.depth >= maxDepth) {
      continue
    }
    for (const step of adjacency.get(current.id) ?? []) {
      if (seen.has(step.nodeId)) {
        continue
      }
      seen.add(step.nodeId)
      queue.push({ id: step.nodeId, depth: current.depth + 1 })
    }
  }
  return seen
}

export function reachableFromMany(seeds, adjacency, maxDepth) {
  const result = new Set()
  for (const seed of seeds) {
    for (const id of boundedReachable(seed, adjacency, maxDepth)) {
      result.add(id)
    }
  }
  return result
}

export function reverseReachableFrom(seeds, reverseAdjacency) {
  const result = new Set()
  for (const seed of seeds) {
    for (const id of boundedReachable(seed, reverseAdjacency)) {
      result.add(id)
    }
  }
  return result
}

export function mergePaths(left, right) {
  const result = []
  for (const id of [...left, ...right]) {
    if (!result.includes(id)) {
      result.push(id)
    }
  }
  return result
}

function intersectionPaths(selectedId, forward, backward, canReachPersistence, reachableFromOrigin) {
  const result = new Set([selectedId])
  for (const id of forward) {
    if (canReachPersistence.has(id)) {
      result.add(id)
    }
  }
  for (const id of backward) {
    if (reachableFromOrigin.has(id)) {
      result.add(id)
    }
  }
  return result
}
