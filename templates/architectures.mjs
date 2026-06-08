import { pickRuleMetadata } from './rule-metadata.mjs'

export const architectureTemplates = [
  {
    id: 'architecture.feature-sliced',
    stage: 'architecture',
    description: 'Frontend modules are organized by feature/slice with internal segments and explicit shared boundaries.',
    rules: {
      enabled: [
        'architecture.feature-sliced.no-cross-feature-internals'
      ]
    },
    ruleMetadata: pickRuleMetadata(['architecture.feature-sliced.no-cross-feature-internals']),
    architecture: [{ id: 'feature-sliced', label: 'Feature-Sliced Frontend', scope: 'frontend' }]
  },
  {
    id: 'architecture.mvvm',
    stage: 'architecture',
    description: 'UI views stay mostly declarative while view-model logic and state are extracted into hooks/controllers.',
    rules: {
      enabled: [
        'architecture.mvvm.thin-view-entry',
        'architecture.mvvm.viewmodel-hook-naming'
      ]
    },
    ruleMetadata: pickRuleMetadata(['architecture.mvvm.thin-view-entry', 'architecture.mvvm.viewmodel-hook-naming']),
    architecture: [{ id: 'mvvm', label: 'MVVM / View-ViewModel-Model', scope: 'frontend' }]
  },
  {
    id: 'architecture.mvc',
    stage: 'architecture',
    description: 'Request entry points are modeled as controllers that coordinate application/domain behavior.',
    rules: {
      enabled: ['architecture.mvc.thin-controller']
    },
    ruleMetadata: pickRuleMetadata(['architecture.mvc.thin-controller']),
    architecture: [{ id: 'mvc', label: 'MVC / Controller Entry Points', scope: 'backend' }]
  },
  {
    id: 'architecture.clean-architecture',
    stage: 'architecture',
    description: 'Backend code is organized around API, application boundaries, domain entities, infrastructure, and persistence.',
    rules: {
      enabled: [
        'architecture.layered.no-ui-imports-in-data-adapters',
        'architecture.clean-architecture.layer-boundaries'
      ]
    },
    ruleMetadata: pickRuleMetadata(['architecture.layered.no-ui-imports-in-data-adapters', 'architecture.clean-architecture.layer-boundaries']),
    architecture: [{ id: 'clean-architecture', label: 'Clean Architecture', scope: 'backend' }]
  },
  {
    id: 'architecture.cqrs',
    stage: 'architecture',
    description: 'Application boundaries separate query/read and command/write flows.',
    architecture: [{ id: 'cqrs', label: 'CQRS', scope: 'backend' }]
  }
]
