import { designStatus } from '#architecture/component-model.mjs'

export const analysisComponents = [
  {
    id: 'scan-orchestrator',
    responsibility: 'Compose source discovery, scanners, enrichers, and graph serialization.',
    role: 'application',
    files: ['src/application/scan.mjs'],
    contracts: ['ScanPhase', 'SourceFileSets', 'Scanner', 'GraphEnricher', 'TemplateRegistry', 'TextWriter'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision:
      'Expose immutable file sets by registered kind and pass only declared inputs and named results between phases.'
  },
  {
    id: 'node-scan',
    responsibility: 'Compose Node adapters for a direct scan execution.',
    role: 'composition-root',
    files: ['src/adapters/node/scan-node.mjs'],
    contracts: ['ScanExecution'],
    compositionRoot: true,
    design: designStatus('pass', 'pass', 'not-applicable', 'pass', 'pass'),
    decision: 'Keep executable environment and adapter selection outside the scan application.'
  },
  {
    id: 'frontend-scanner',
    language: 'typescript',
    responsibility: 'Extract frontend files, imports, behavior, and endpoint evidence.',
    role: 'adapter',
    files: ['src/scanners/scan-front.mjs'],
    contracts: ['Scanner'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Add frontend technologies as registered scanners receiving explicit source capabilities.'
  },
  {
    id: 'backend-analysis-session',
    responsibility: 'Own immutable backend declaration indexes without retaining parser documents.',
    role: 'core',
    files: ['src/core/backend-analysis-session.mjs', 'src/core/backend-declaration-index.mjs'],
    contracts: ['BackendFileSet', 'BackendAnalysisSession'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Expose semantic lookup queries while the language-neutral document store owns parsed syntax.'
  },
  {
    id: 'backend-scanner',
    language: 'csharp',
    responsibility: 'Expose the stable backend scanner module surface.',
    role: 'adapter',
    files: ['src/scanners/scan-back.mjs'],
    contracts: ['BackendScannerApi'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'not-applicable', 'pass', 'pass'),
    decision: 'Keep this facade free of implementation logic while scanner families evolve independently.'
  },
  {
    id: 'backend-classification-scanner',
    language: 'csharp',
    responsibility: 'Classify backend source files using configured and semantic evidence.',
    role: 'adapter',
    files: ['src/scanners/scan-back-classification.mjs'],
    contracts: ['Scanner', 'BackendAnalysisSession'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Extend semantic role recognition without coupling classification to other backend scanners.'
  },
  {
    id: 'backend-persistence-scanner',
    language: 'csharp',
    responsibility: 'Extract backend contexts, entities, tables, domain relationships, and ORM usage.',
    role: 'adapter',
    files: ['src/scanners/scan-back-persistence.mjs'],
    contracts: ['Scanner', 'BackendAnalysisSession'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Extend persistence conventions through focused entity, mapping, relationship, and usage extractors.'
  },
  {
    id: 'backend-session-builder',
    language: 'csharp',
    responsibility: 'Build and query execution-scoped backend analysis sessions from source declarations.',
    role: 'adapter',
    files: ['src/scanners/scan-back-session.mjs'],
    contracts: ['BackendAnalysisSession'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep source acquisition explicit and delegate immutable index ownership to BackendAnalysisSession.'
  },
  {
    id: 'backend-request-scanner',
    language: 'csharp',
    responsibility: 'Extract controller endpoints, request dispatches, and handler relationships.',
    role: 'adapter',
    files: ['src/scanners/scan-back-requests.mjs'],
    contracts: ['Scanner', 'BackendAnalysisSession'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Extend request conventions through focused parsers while preserving endpoint and dispatch contracts.'
  },
  {
    id: 'backend-dependency-scanner',
    language: 'csharp',
    responsibility: 'Resolve backend constructor dependencies to concrete or logical graph nodes.',
    role: 'adapter',
    files: ['src/scanners/scan-back-dependencies.mjs'],
    contracts: ['Scanner', 'BackendAnalysisSession'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision:
      'Extend dependency recognition through focused parsing and resolution helpers without changing orchestration.'
  },
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
    files: ['rules/frontend-guardrails.mjs', 'rules/typescript-architecture-guardrails.mjs'],
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
