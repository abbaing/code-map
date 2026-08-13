import { designStatus } from '#architecture/component-model.mjs'

export const analysisComponents = [
  {
    id: 'scan-orchestrator',
    responsibility: 'Compose source discovery, scanners, enrichers, and graph serialization.',
    role: 'application',
    files: [
      'src/application/scan.mjs',
      'src/application/scan-capabilities.mjs',
      'src/application/scan-coverage.mjs',
      'src/application/scan-files.mjs',
      'src/application/scan-finalization.mjs',
      'src/application/scan-internal-resolution.mjs',
      'src/application/scan-internals.mjs',
      'src/application/scan-pipeline.mjs',
      'src/application/scan-runtime-links.mjs'
    ],
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
    responsibility: 'Project registered backend persistence facts into entities, tables, relationships, and usage.',
    role: 'adapter',
    files: [
      'src/scanners/scan-back-persistence.mjs',
      'src/scanners/scan-back-persistence-entities.mjs',
      'src/scanners/scan-back-persistence-relationships.mjs',
      'src/scanners/scan-back-persistence-resolution.mjs',
      'src/scanners/scan-back-persistence-tables.mjs',
      'src/scanners/scan-back-persistence-usage.mjs'
    ],
    contracts: ['Scanner', 'BackendAnalysisSession'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Consume parser-provided facts without importing language parsers, syntax trees, or file extensions.'
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
  }
]
