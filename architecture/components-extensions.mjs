import { designStatus } from '#architecture/component-model.mjs'

export const extensionComponents = [
  {
    id: 'rules',
    responsibility: 'Run language-neutral file rules against source evidence.',
    role: 'extension',
    files: ['rules/rule-runner.mjs'],
    contracts: ['Rule'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Rules receive isolated finding and source capabilities through registered enrichers.'
  },
  {
    id: 'typescript-language-rules',
    language: 'typescript',
    responsibility: 'Adapt TypeScript syntax into technology, React, and frontend architecture findings.',
    role: 'adapter',
    files: [
      'rules/frontend-guardrail-catalog.mjs',
      'rules/frontend-guardrails.mjs',
      'rules/typescript-architecture-catalog.mjs',
      'rules/typescript-architecture-guardrails.mjs',
      'rules/typescript-architecture-policy.mjs'
    ],
    contracts: ['Rule'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep TypeScript AST APIs in an optional language adapter outside the core rule runner.'
  },
  {
    id: 'csharp-language-rules',
    language: 'csharp',
    responsibility: 'Adapt C# syntax into backend architecture findings.',
    role: 'adapter',
    files: ['rules/csharp-architecture-guardrails.mjs'],
    contracts: ['Rule'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep C# AST APIs in an optional language adapter outside the core rule runner.'
  },
  {
    id: 'findings',
    responsibility: 'Collect, suppress, sort, and attach rule findings.',
    role: 'core',
    files: ['rules/findings.mjs'],
    contracts: ['FindingSink', 'FindingSource'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'not-applicable', 'pass', 'pass'),
    decision: 'Keep collection execution-scoped and expose separate immutable write and read capabilities.'
  },
  {
    id: 'catalog-entry-merge',
    responsibility: 'Merge ordered catalog entries by stable identity and explicit field precedence.',
    role: 'core',
    files: ['src/core/catalog-entries.mjs'],
    contracts: ['CatalogEntryMerge'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'not-applicable', 'pass', 'pass'),
    decision: 'Keep shared catalog composition deterministic without introducing a generic utility module.'
  },
  {
    id: 'templates',
    responsibility: 'Register, normalize, and compose architectural capabilities.',
    role: 'composition-root',
    files: [
      'templates/architectures.mjs',
      'templates/catalog.mjs',
      'templates/csharp.mjs',
      'templates/core.mjs',
      'templates/dotnet-api.mjs',
      'templates/entity-framework.mjs',
      'templates/http-endpoints.mjs',
      'templates/quality.mjs',
      'templates/react.mjs',
      'templates/registry.mjs',
      'templates/rule-metadata.mjs',
      'templates/template-merge.mjs',
      'templates/template-plugins.mjs',
      'templates/template-resolution.mjs',
      'templates/template-store.mjs',
      'templates/typescript.mjs'
    ],
    contracts: ['Template', 'TemplateDependency', 'TemplateRegistry', 'Parser', 'Scanner', 'GraphEnricher', 'FileKind'],
    compositionRoot: true,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Validate capabilities at registration and project only their declared required and optional inputs.'
  },
  {
    id: 'template-contracts',
    responsibility: 'Validate templates, capability registries, and focused capability inputs.',
    role: 'core',
    files: ['templates/contracts.mjs'],
    contracts: ['Template', 'TemplateDependency', 'TemplateRegistry', 'Parser', 'Scanner', 'GraphEnricher', 'FileKind'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep capability validation and input projection independent from template composition.'
  }
]
