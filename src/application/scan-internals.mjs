import { findInternalComponentParent, isInternalComponentNode } from '#app/scan-internal-resolution.mjs'

export function trackInternalComponents(graph) {
  const internalsByParent = new Map()

  for (const node of graph.allNodes()) {
    if (!isInternalComponentNode(node)) {
      continue
    }
    const parentId = findInternalComponentParent(graph, node)
    if (parentId) {
      const internals = internalsByParent.get(parentId) ?? []
      internals.push(node.id)
      internalsByParent.set(parentId, internals)
    }
  }

  for (const [parentId, internalIds] of internalsByParent) {
    const parent = graph.getNode(parentId)
    const internals = internalIds.map((id) => graph.getNode(id)).filter(Boolean)
    if (!parent) {
      continue
    }

    addInternalComponentQuality(graph, parent, internals)
    for (const internal of internals) {
      graph.addNode(internal.id, {
        meta: {
          internalComponent: {
            parentId,
            role: 'supporting-component'
          }
        }
      })
    }
  }
}

function addInternalComponentQuality(graph, parent, internals) {
  const parentQuality = parent.meta?.quality
  const qualityComponents = internals.filter((internal) => internal.meta?.quality)
  if (qualityComponents.length === 0) {
    return
  }

  const currentInternalComponents = parentQuality?.internalComponents ?? []
  const internalComponents = [
    ...currentInternalComponents,
    ...qualityComponents.map((internal) => ({
      id: internal.id,
      label: internal.label,
      path: internal.path,
      score: internal.meta.quality.score,
      summary: internal.meta.quality.summary,
      cohesion: internal.meta.quality.cohesion,
      coupling: internal.meta.quality.coupling
    }))
  ].sort((a, b) => a.score - b.score || a.label.localeCompare(b.label))

  const inheritedQuality = qualityComponents[0].meta.quality
  const baseQuality = parentQuality ?? {
    score: inheritedQuality.score,
    summary: 'Quality inherited from internal components',
    cohesion: inheritedQuality.cohesion,
    coupling: inheritedQuality.coupling,
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
