const METRIC_TYPES = new Set([
  'component',
  'main-component',
  'subcomponent',
  'page',
  'route',
  'hook',
  'service',
  'repository',
  'controller',
  'query',
  'command',
  'handler'
])

export function isEntryPoint(node, projectContext) {
  const projectMap = projectContext.projectMap
  return (
    projectMap.frontend.entryPoints.includes(node.path) ||
    projectMap.backend?.entryPointSuffixes?.some((suffix) => node.path?.endsWith(suffix)) ||
    node.type === 'table'
  )
}

function clampScore(value) {
  return Math.max(1, Math.min(10, value))
}

export function createQualityScoringPolicy(implementation) {
  if (!implementation || typeof implementation.score !== 'function') {
    throw new TypeError('QualityScoringPolicy must implement score(evidence).')
  }
  return Object.freeze({ score: implementation.score.bind(implementation) })
}

export const defaultQualityScoringPolicy = createQualityScoringPolicy({
  score(evidence) {
    const {
      internalRelations,
      externalRelations,
      outgoingDependencies,
      incomingUsages,
      relatedRelations,
      externalModuleCount,
      insideFeatureFolder,
      entryPoint
    } = evidence
    const internalRatioBonus = relatedRelations > 0 ? Math.round((internalRelations / relatedRelations) * 3) : 0
    const dependencyPenalty = outgoingDependencies > 12 ? 2 : outgoingDependencies > 8 ? 1 : 0
    const unusedPenalty = incomingUsages === 0 && !entryPoint ? 1 : 0
    const outgoingDependencyPenalty = Math.max(0, outgoingDependencies - 4)
    const externalModulePenalty = externalModuleCount * 2
    const externalDominancePenalty = externalRelations > internalRelations && externalRelations > 2 ? 1 : 0
    const noDependencyBonus = outgoingDependencies === 0 ? 1 : 0

    let cohesion = 6 + internalRatioBonus - dependencyPenalty - unusedPenalty
    if (insideFeatureFolder) {
      cohesion += 1
    }
    let coupling = 10 - outgoingDependencyPenalty - externalModulePenalty - externalDominancePenalty
    if (noDependencyBonus) {
      coupling = Math.min(10, coupling + noDependencyBonus)
    }

    const cohesionScore = clampScore(cohesion)
    const couplingScore = clampScore(coupling)
    return {
      score: Math.round((cohesionScore + couplingScore + Math.min(cohesionScore, couplingScore)) / 3),
      formula: 'round((cohesion + coupling + min(cohesion, coupling)) / 3)',
      cohesion: {
        score: cohesionScore,
        calculation: {
          base: 6,
          internalRatioBonus,
          featureFolderBonus: insideFeatureFolder ? 1 : 0,
          dependencyPenalty,
          unusedPenalty
        }
      },
      coupling: {
        score: couplingScore,
        calculation: {
          base: 10,
          outgoingDependencyPenalty,
          externalModulePenalty,
          externalDominancePenalty,
          noDependencyBonus
        }
      }
    }
  }
})

function buildCohesionReason(node, internalRelations, externalRelations, outgoingCount, incomingCount, projectMap) {
  const parts = [
    `${internalRelations} relations inside module ${node.module}`,
    `${externalRelations} relations outside module`,
    `${outgoingCount} outgoing dependencies`,
    `${incomingCount} detected usages`
  ]
  if (isInsideFeatureFolder(node, projectMap)) {
    parts.push('located inside its feature folder')
  }
  return parts.join('; ')
}

function buildCouplingReason(outgoingCount, externalModules, outgoingExternal) {
  const externalList = [...externalModules].filter(Boolean)
  const parts = [
    `${outgoingCount} outgoing dependencies`,
    `${externalList.length} external modules: ${externalList.length ? externalList.join(', ') : 'none'}`
  ]
  if (outgoingExternal.length > 0) {
    parts.push(
      `external deps: ${outgoingExternal
        .slice(0, 6)
        .map((node) => node.label)
        .join(', ')}`
    )
  }
  return parts.join('; ')
}

export function applyQualityMetrics(graph, projectContext, scoringPolicy) {
  assertQualityScoringPolicy(scoringPolicy)
  const projectMap = projectContext.projectMap
  const incomingByNode = new Map()
  const outgoingByNode = new Map()

  for (const node of graph.allNodes()) {
    incomingByNode.set(node.id, [])
    outgoingByNode.set(node.id, [])
  }

  for (const edge of graph.allEdges()) {
    incomingByNode.get(edge.to)?.push(edge)
    outgoingByNode.get(edge.from)?.push(edge)
  }

  for (const node of graph.allNodes()) {
    if (!METRIC_TYPES.has(node.type)) {
      continue
    }

    const incoming = incomingByNode.get(node.id) ?? []
    const outgoing = outgoingByNode.get(node.id) ?? []
    const scoredIncoming = incoming.filter((edge) => isQualityEdge(graph, edge))
    const scoredOutgoing = outgoing.filter((edge) => isQualityEdge(graph, edge))
    const relatedEdges = [...scoredIncoming, ...scoredOutgoing]
    const relatedNodes = relatedEdges
      .map((edge) => (edge.from === node.id ? graph.getNode(edge.to) : graph.getNode(edge.from)))
      .filter(Boolean)

    const internalRelations = relatedNodes.filter((related) => related.module === node.module).length
    const externalRelations = relatedNodes.filter((related) => related.module !== node.module).length
    const outgoingExternal = scoredOutgoing
      .map((edge) => graph.getNode(edge.to))
      .filter((related) => related && related.module !== node.module && related.module !== projectMap.modules.shared)
    const externalModules = new Set(outgoingExternal.map((related) => related.module))
    const outgoingCount = scoredOutgoing.length
    const incomingCount = scoredIncoming.length
    const insideFeatureFolder = isInsideFeatureFolder(node, projectMap)
    const entryPoint = isEntryPoint(node, projectContext)
    const scoring = assertQualityScore(
      scoringPolicy.score(
        Object.freeze({
          internalRelations,
          externalRelations,
          outgoingDependencies: outgoingCount,
          incomingUsages: incomingCount,
          relatedRelations: relatedNodes.length,
          externalModuleCount: externalModules.size,
          insideFeatureFolder,
          entryPoint
        })
      )
    )
    const { score } = scoring
    const cohesionScore = scoring.cohesion.score
    const couplingScore = scoring.coupling.score
    const topRelated = relatedNodes.slice(0, 8).map((related) => ({
      id: related.id,
      label: related.label,
      type: related.type,
      module: related.module
    }))

    graph.addNode(node.id, {
      meta: {
        quality: {
          score,
          summary: `Score ${score}/10; cohesion ${cohesionScore}/10; coupling ${couplingScore}/10`,
          cohesion: {
            score: cohesionScore,
            reason: buildCohesionReason(
              node,
              internalRelations,
              externalRelations,
              outgoingCount,
              incomingCount,
              projectMap
            )
          },
          coupling: {
            score: couplingScore,
            reason: buildCouplingReason(outgoingCount, externalModules, outgoingExternal)
          },
          related: topRelated,
          calculation: {
            formula: scoring.formula,
            inputs: {
              internalRelations,
              externalRelations,
              outgoingDependencies: outgoingCount,
              incomingUsages: incomingCount,
              externalModules: [...externalModules].filter(Boolean).sort(),
              insideFeatureFolder,
              entryPoint
            },
            cohesion: {
              ...scoring.cohesion.calculation,
              result: cohesionScore
            },
            coupling: {
              ...scoring.coupling.calculation,
              result: couplingScore
            }
          }
        }
      }
    })
  }
}

function assertQualityScoringPolicy(policy) {
  if (!policy || typeof policy.score !== 'function') {
    throw new TypeError('applyQualityMetrics requires a QualityScoringPolicy.')
  }
}

function assertQualityScore(result) {
  if (
    !result ||
    !isScore(result.score) ||
    typeof result.formula !== 'string' ||
    !isScore(result.cohesion?.score) ||
    !result.cohesion?.calculation ||
    !isScore(result.coupling?.score) ||
    !result.coupling?.calculation
  ) {
    throw new TypeError('QualityScoringPolicy must return scores, a formula, and calculation details.')
  }
  return result
}

function isScore(value) {
  return Number.isInteger(value) && value >= 1 && value <= 10
}

function isInsideFeatureFolder(node, projectMap) {
  const pattern = projectMap.frontend.featureFolderPattern.replace('{module}', node.module)
  return Boolean(node.path?.includes(pattern))
}

function isQualityEdge(graph, edge) {
  const from = graph.getNode(edge.from)
  const to = graph.getNode(edge.to)
  return !isDataNode(from) && !isDataNode(to)
}

function isDataNode(node) {
  return node?.type === 'entity' || node?.type === 'table'
}
