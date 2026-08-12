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
    const cohesion = scoreCohesion(evidence)
    const coupling = scoreCoupling(evidence)
    return {
      score: Math.round((cohesion.score + coupling.score + Math.min(cohesion.score, coupling.score)) / 3),
      formula: 'round((cohesion + coupling + min(cohesion, coupling)) / 3)',
      cohesion,
      coupling
    }
  }
})

function scoreCohesion(evidence) {
  const ratioBonus =
    evidence.relatedRelations > 0 ? Math.round((evidence.internalRelations / evidence.relatedRelations) * 3) : 0
  const dependencyPenalty = evidence.outgoingDependencies > 12 ? 2 : evidence.outgoingDependencies > 8 ? 1 : 0
  const unusedPenalty = evidence.incomingUsages === 0 && !evidence.entryPoint ? 1 : 0
  const featureFolderBonus = evidence.insideFeatureFolder ? 1 : 0
  return {
    score: clampScore(6 + ratioBonus + featureFolderBonus - dependencyPenalty - unusedPenalty),
    calculation: { base: 6, internalRatioBonus: ratioBonus, featureFolderBonus, dependencyPenalty, unusedPenalty }
  }
}

function scoreCoupling(evidence) {
  const outgoingDependencyPenalty = Math.max(0, evidence.outgoingDependencies - 4)
  const externalModulePenalty = evidence.externalModuleCount * 2
  const externalDominancePenalty =
    evidence.externalRelations > evidence.internalRelations && evidence.externalRelations > 2 ? 1 : 0
  const noDependencyBonus = evidence.outgoingDependencies === 0 ? 1 : 0
  let score = 10 - outgoingDependencyPenalty - externalModulePenalty - externalDominancePenalty
  if (noDependencyBonus) {
    score = Math.min(10, score + noDependencyBonus)
  }
  return {
    score: clampScore(score),
    calculation: {
      base: 10,
      outgoingDependencyPenalty,
      externalModulePenalty,
      externalDominancePenalty,
      noDependencyBonus
    }
  }
}

export function assertQualityScoringPolicy(policy) {
  if (!policy || typeof policy.score !== 'function') {
    throw new TypeError('applyQualityMetrics requires a QualityScoringPolicy.')
  }
}

export function assertQualityScore(result) {
  const valid =
    result &&
    isScore(result.score) &&
    typeof result.formula === 'string' &&
    isScore(result.cohesion?.score) &&
    result.cohesion?.calculation &&
    isScore(result.coupling?.score) &&
    result.coupling?.calculation
  if (!valid) {
    throw new TypeError('QualityScoringPolicy must return scores, a formula, and calculation details.')
  }
  return result
}

function isScore(value) {
  return Number.isInteger(value) && value >= 1 && value <= 10
}
