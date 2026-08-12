import { state } from '#viewer/viewer-state.js'

export function orderDomainClusterForEdges(nodes) {
  if (nodes.length < 4) {
    return nodes
  }
  const ids = new Set(nodes.map((node) => node.id))
  const edges = state.graph.edges
    .filter((edge) => edge.type === 'domain-relation' && ids.has(edge.from) && ids.has(edge.to))
    .map((edge) => [edge.from, edge.to])
  if (edges.length < 2) {
    return nodes
  }
  let ordered = [...nodes]
  let bestScore = circularCrossingScore(ordered, edges)
  for (let pass = 0; pass < 6; pass += 1) {
    const result = improveCircularOrder(ordered, edges, bestScore, pass)
    ordered = result.ordered
    bestScore = result.score
    if (!result.improved) {
      break
    }
  }
  return ordered
}

export function seededUnit(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 10000) / 10000
}

function improveCircularOrder(current, edges, currentScore, pass) {
  let ordered = current
  let score = currentScore
  let improved = false
  for (let first = 0; first < ordered.length; first += 1) {
    for (let second = first + 1; second < ordered.length; second += 1) {
      const candidate = [...ordered]
      ;[candidate[first], candidate[second]] = [candidate[second], candidate[first]]
      const candidateScore = circularCrossingScore(candidate, edges)
      const tieBreak =
        candidateScore === score && seededUnit(`${candidate[first].id}:${candidate[second].id}:${pass}`) < 0.08
      if (candidateScore < score || tieBreak) {
        ordered = candidate
        score = candidateScore
        improved = true
      }
    }
  }
  return { ordered, score, improved }
}

function circularCrossingScore(nodes, edges) {
  const indexById = new Map(nodes.map((node, index) => [node.id, index]))
  let crossings = 0
  let span = 0
  for (let first = 0; first < edges.length; first += 1) {
    const [a, b] = edges[first]
    const ai = indexById.get(a)
    const bi = indexById.get(b)
    if (ai === undefined || bi === undefined) {
      continue
    }
    span += circularSpan(ai, bi, nodes.length)
    for (let second = first + 1; second < edges.length; second += 1) {
      const [c, d] = edges[second]
      if (a === c || a === d || b === c || b === d) {
        continue
      }
      const ci = indexById.get(c)
      const di = indexById.get(d)
      if (ci !== undefined && di !== undefined && chordsCross(ai, bi, ci, di, nodes.length)) {
        crossings++
      }
    }
  }
  return crossings * 1000 + span
}

function circularSpan(a, b, length) {
  const direct = Math.abs(a - b)
  return Math.min(direct, length - direct)
}

function chordsCross(a, b, c, d, length) {
  const first = orderedChord(a, b)
  const second = orderedChord(c, d)
  const wrappedA = circularSpan(first.start, first.end, length) !== Math.abs(first.start - first.end)
  const wrappedC = circularSpan(second.start, second.end, length) !== Math.abs(second.start - second.end)
  return wrappedA || wrappedC ? wrappedCross(first, second) : directCross(first, second)
}

function orderedChord(start, end) {
  return start > end ? { start: end, end: start } : { start, end }
}

function directCross(first, second) {
  return (
    (first.start < second.start && second.start < first.end && first.end < second.end) ||
    (second.start < first.start && first.start < second.end && second.end < first.end)
  )
}

function wrappedCross(first, second) {
  const a = first.start
  const b = first.end
  const c = second.start
  const d = second.end
  return (a < c && c < b && (d < a || b < d)) || (c < a && a < d && (b < c || d < b))
}
