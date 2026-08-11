import { applyQualityMetrics, defaultQualityScoringPolicy } from '#core/quality.mjs'
import { attachFindingsToNodes } from '#rules/findings.mjs'

export const coverageTemplate = {
  id: 'coverage',
  stage: 'quality',
  description: 'Test file detection and source coverage metadata.'
}

export const qualityTemplate = {
  id: 'quality',
  stage: 'quality',
  description: 'Coverage, cohesion/coupling score, orphan detection, and findings attachment.',
  capabilities: {
    enrichers: [
      { id: 'quality.coverage', requires: ['applyCoverage'], run: (context) => context.applyCoverage() },
      {
        id: 'quality.score',
        requires: ['graph', 'projectContext'],
        run: (context) => applyQualityMetrics(context.graph, context.projectContext, defaultQualityScoringPolicy)
      },
      {
        id: 'quality.track-internals',
        requires: ['trackInternalComponents'],
        run: (context) => context.trackInternalComponents()
      },
      {
        id: 'quality.findings',
        priority: 1000,
        requires: ['graph', 'findingSource'],
        run: (context) => attachFindingsToNodes(context.graph, context.findingSource.active())
      }
    ]
  }
}
