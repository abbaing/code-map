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
      { id: 'quality.coverage', run: context => context.applyCoverage() },
      { id: 'quality.score', run: context => applyQualityMetrics(context.graph) },
      { id: 'quality.collapse-internals', run: context => context.collapseInternalComponents() },
      { id: 'quality.guardrails', run: context => runFrontendGuardrails(context.files.frontFiles, context.registry.rules) },
      { id: 'quality.architecture-guardrails', run: context => runArchitectureGuardrails([...context.files.frontFiles, ...context.files.backFiles], context.registry.rules) },
      { id: 'quality.findings', run: context => attachFindingsToNodes(context.graph) }
    ]
  }
}
