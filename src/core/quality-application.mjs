import { assertQualityScore, assertQualityScoringPolicy } from '#core/quality-policy.mjs'
import {
  collectQualityEvidence,
  createQualityIndexes,
  describeCohesion,
  describeCoupling
} from '#core/quality-evidence.mjs'

export function applyQualityMetrics(graph, projectContext, scoringPolicy) {
  assertQualityScoringPolicy(scoringPolicy)
  const indexes = createQualityIndexes(graph)
  for (const node of graph.allNodes()) {
    const evidence = collectQualityEvidence(graph, node, projectContext, indexes)
    if (evidence) {
      applyNodeQuality(graph, node, evidence, assertQualityScore(scoringPolicy.score(evidence.scoring)))
    }
  }
}

function applyNodeQuality(graph, node, evidence, scoring) {
  const cohesionScore = scoring.cohesion.score
  const couplingScore = scoring.coupling.score
  graph.addNode(node.id, {
    meta: {
      quality: {
        score: scoring.score,
        summary: `Score ${scoring.score}/10; cohesion ${cohesionScore}/10; coupling ${couplingScore}/10`,
        cohesion: { score: cohesionScore, reason: describeCohesion(node, evidence.scoring) },
        coupling: {
          score: couplingScore,
          reason: describeCoupling(evidence.scoring, evidence.externalModules, evidence.outgoingExternal)
        },
        related: evidence.relatedNodes.slice(0, 8).map(toRelatedNode),
        calculation: calculationDetails(evidence.scoring, evidence.externalModules, scoring)
      }
    }
  })
}

function calculationDetails(evidence, externalModules, scoring) {
  return {
    formula: scoring.formula,
    inputs: {
      internalRelations: evidence.internalRelations,
      externalRelations: evidence.externalRelations,
      outgoingDependencies: evidence.outgoingDependencies,
      incomingUsages: evidence.incomingUsages,
      externalModules: [...externalModules].filter(Boolean).sort(),
      insideFeatureFolder: evidence.insideFeatureFolder,
      entryPoint: evidence.entryPoint
    },
    cohesion: { ...scoring.cohesion.calculation, result: scoring.cohesion.score },
    coupling: { ...scoring.coupling.calculation, result: scoring.coupling.score }
  }
}

function toRelatedNode(related) {
  return { id: related.id, label: related.label, type: related.type, module: related.module }
}
