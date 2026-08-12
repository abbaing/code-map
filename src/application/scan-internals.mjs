import { findInternalComponentParent, isInternalComponentNode } from '#app/scan-internal-resolution.mjs'

export function trackInternalComponents(graph) {
  const internalToParent = new Map()

  for (const node of graph.allNodes()) {
    if (!isInternalComponentNode(node)) {
      continue
    }
    const parentId = findInternalComponentParent(graph, node)
    if (parentId) {
      internalToParent.set(node.id, parentId)
    }
  }

  for (const [internalId, parentId] of internalToParent) {
    const internal = graph.getNode(internalId)
    const parent = graph.getNode(parentId)
    if (!internal || !parent) {
      continue
    }
    addInternalComponentQuality(graph, parent, internal)
    graph.addNode(internalId, {
      meta: {
        internalComponent: {
          parentId,
          role: 'supporting-component'
        }
      }
    })
  }
}

function addInternalComponentQuality(graph, parent, internal) {
  const parentQuality = parent.meta?.quality
  const internalQuality = internal.meta?.quality
  if (!internalQuality) {
    return
  }

  const currentInternalComponents = parentQuality?.internalComponents ?? []
  const internalComponents = [
    ...currentInternalComponents,
    {
      id: internal.id,
      label: internal.label,
      path: internal.path,
      score: internalQuality.score,
      summary: internalQuality.summary,
      cohesion: internalQuality.cohesion,
      coupling: internalQuality.coupling
    }
  ].sort((a, b) => a.score - b.score || a.label.localeCompare(b.label))

  const baseQuality = parentQuality ?? {
    score: internalQuality.score,
    summary: 'Quality inherited from internal components',
    cohesion: internalQuality.cohesion,
    coupling: internalQuality.coupling,
    related: []
  }

  const scores = [parentQuality?.score, ...internalComponents.map((component) => component.score)].filter((score) =>
    Number.isFinite(score)
  )
  const aggregateScore =
    scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : baseQuality.score
  const worst = internalComponents[0]
  const internalSummary = `${internalComponents.length} internal component${internalComponents.length === 1 ? '' : 's'} tracked; worst ${worst.label} ${worst.score}/10`

  graph.addNode(parent.id, {
    meta: {
      quality: {
        ...baseQuality,
        score: aggregateScore,
        summary: `${baseQuality.summary}; ${internalSummary}`,
        internalComponents
      }
    }
  })
}
