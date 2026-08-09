import { applyQualityMetrics } from '../quality.mjs'
import { runArchitectureGuardrails } from '../rules/architecture-guardrails.mjs'
import { runFrontendGuardrails } from '../rules/frontend-guardrails.mjs'
import { attachFindingsToNodes } from '../rules/findings.mjs'

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
        run: (context) => applyQualityMetrics(context.graph, context.projectContext)
      },
      {
        id: 'quality.track-internals',
        requires: ['trackInternalComponents'],
        run: (context) => context.trackInternalComponents()
      },
      {
        id: 'quality.guardrails',
        requires: ['files', 'registry', 'projectContext', 'findingSink', 'sourceReader'],
        run: (context) =>
          runFrontendGuardrails(
            context.files.frontFiles,
            context.registry.rules,
            context.projectContext,
            context.findingSink,
            context.sourceReader
          )
      },
      {
        id: 'quality.architecture-guardrails',
        requires: ['files', 'registry', 'projectContext', 'findingSink', 'sourceReader'],
        run: (context) =>
          runArchitectureGuardrails(
            [...context.files.frontFiles, ...context.files.backFiles],
            context.registry.rules,
            context.projectContext,
            context.findingSink,
            context.sourceReader
          )
      },
      {
        id: 'quality.findings',
        requires: ['graph', 'findingSource'],
        run: (context) => attachFindingsToNodes(context.graph, context.findingSource.active())
      }
    ]
  }
}
