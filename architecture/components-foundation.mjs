import { designStatus } from '#architecture/component-model.mjs'

export const foundationComponents = [
  {
    id: 'public-api',
    responsibility: 'Compose and expose the supported package entry points without implementing domain behavior.',
    role: 'composition-root',
    files: ['index.mjs'],
    contracts: ['PackageExports'],
    compositionRoot: true,
    design: designStatus('pass', 'pass', 'not-applicable', 'pass', 'pass'),
    decision:
      'Keep supported entry points explicit and extend behavior behind their validated registries and contracts.'
  },
  {
    id: 'graph',
    responsibility: 'Own the in-memory node and edge model.',
    role: 'core',
    files: ['src/core/graph.mjs', 'src/core/graph-model.mjs', 'src/core/graph-document.mjs'],
    contracts: ['Graph'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'not-applicable', 'pass', 'pass'),
    decision: 'Graph has no subtype family; consumers rely on its small structural API.'
  },
  {
    id: 'configuration',
    responsibility: 'Validate, normalize, locate, and expose project configuration.',
    role: 'core',
    files: [
      'src/core/config.mjs',
      'src/core/config-normalization.mjs',
      'src/core/config-validation.mjs',
      'src/core/project-context.mjs'
    ],
    contracts: ['ProjectContext'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'not-applicable', 'pass', 'pass'),
    decision:
      'ProjectContext is immutable, injected, and consumes platform capabilities without importing Node adapters.'
  },
  {
    id: 'platform-contracts',
    responsibility: 'Validate the minimal capabilities required from a runtime platform.',
    role: 'core',
    files: ['platform/contracts.mjs'],
    contracts: ['FileSystemPort', 'EnvironmentPort', 'ClockPort', 'HashPort', 'RandomPort'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep capability validation structural so tests and future runtimes can provide small implementations.'
  },
  {
    id: 'node-platform',
    responsibility: 'Adapt Node filesystem, process, clock, hashing, and randomness APIs to platform contracts.',
    role: 'adapter',
    files: ['platform/node.mjs'],
    contracts: ['FileSystemPort', 'EnvironmentPort', 'ClockPort', 'HashPort', 'RandomPort'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep Node-specific imports contained here and select this adapter only at executable boundaries.'
  },
  {
    id: 'detection',
    responsibility: 'Detect project technologies and propose an initial project map.',
    role: 'core',
    files: [
      'src/core/detect.mjs',
      'src/core/detection-files.mjs',
      'src/core/detection-stacks.mjs',
      'src/core/detection-structure.mjs',
      'src/core/detection-presets.mjs',
      'src/core/detection-project.mjs'
    ],
    contracts: ['ProjectDetector'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Compose ordered stack detectors over an injected, bounded filesystem capability.'
  },
  {
    id: 'node-detection',
    responsibility: 'Adapt Node filesystem capabilities to project detection.',
    role: 'adapter',
    files: ['src/adapters/node/detect-node.mjs'],
    contracts: ['ProjectDetector'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'not-applicable', 'pass', 'pass'),
    decision: 'Keep the default Node filesystem selection outside detection policy.'
  },
  {
    id: 'classification',
    responsibility: 'Classify source paths into modules, layers, and architectural types.',
    role: 'core',
    files: ['src/core/classify.mjs', 'src/core/classifier-registry.mjs'],
    contracts: ['SourceClassifier'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Compose ordered classifier strategies over explicit repository paths and ProjectContext.'
  },
  {
    id: 'resolution',
    language: 'typescript',
    responsibility: 'Adapt TypeScript and JavaScript syntax, imports, and endpoint extraction to source contracts.',
    role: 'adapter',
    files: [
      'src/adapters/parsers/typescript.mjs',
      'src/adapters/parsers/typescript-files.mjs',
      'src/adapters/parsers/typescript-frontend.mjs',
      'src/adapters/parsers/typescript-resolver.mjs',
      'src/adapters/parsers/typescript-endpoints.mjs'
    ],
    contracts: ['Parser', 'ImportResolver', 'EndpointExtractor'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Contain the TypeScript compiler API and language conventions behind registered parser capabilities.'
  },
  {
    id: 'endpoints',
    responsibility: 'Normalize, create, deduplicate, match, and connect language-neutral HTTP endpoint evidence.',
    role: 'core',
    files: ['src/core/endpoints.mjs'],
    contracts: ['Endpoint', 'EndpointExtractor', 'EndpointMatcher'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep HTTP graph policy independent from the language adapters that extract endpoint evidence.'
  },
  {
    id: 'source-analysis',
    responsibility: 'Provide language-neutral repository path and naming helpers.',
    role: 'core',
    files: ['src/core/source-analysis.mjs'],
    contracts: ['SourcePath'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep language syntax outside core and expose only stable path policy here.'
  },
  {
    id: 'source-documents',
    responsibility: 'Register language parsers and cache opaque source documents for one scan execution.',
    role: 'core',
    files: ['src/core/source-documents.mjs'],
    contracts: ['Parser', 'ParserRegistry', 'SourceDocumentStore'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Treat parser syntax as opaque and expose language facts through registered capabilities.'
  },
  {
    id: 'csharp-parser',
    language: 'csharp',
    responsibility:
      'Adapt Tree-sitter C# syntax, declarations, and backend facts to the language-neutral parser contract.',
    role: 'adapter',
    files: ['src/adapters/parsers/csharp.mjs', 'src/adapters/parsers/csharp-backend.mjs'],
    contracts: ['Parser'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Contain Tree-sitter and C# syntax conventions as an optional registered language feature.'
  },
  {
    id: 'source-files',
    responsibility: 'Provide bounded source reading and deterministic filesystem walking.',
    role: 'core',
    files: ['src/core/scan-utils.mjs', 'src/core/source-reader.mjs', 'src/core/source-walker.mjs'],
    contracts: ['SourceReader', 'SourceWalker'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'not-applicable', 'pass', 'pass'),
    decision: 'Keep bounded reads and deterministic walking behind injected filesystem and path capabilities.'
  },
  {
    id: 'quality',
    responsibility: 'Calculate maintainability signals from an architectural graph.',
    role: 'core',
    files: [
      'src/core/quality.mjs',
      'src/core/quality-application.mjs',
      'src/core/quality-evidence.mjs',
      'src/core/quality-policy.mjs'
    ],
    contracts: ['GraphEnricher', 'QualityScoringPolicy'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Collect graph evidence separately from the injected scoring policy and retain auditable calculations.'
  },
  {
    id: 'scan-pipeline',
    responsibility: 'Validate and execute ordered scan phases through declared inputs and outputs.',
    role: 'core',
    files: ['src/core/scan-pipeline.mjs'],
    contracts: ['ScanPhase'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep phase execution generic, synchronous, deterministic, and independent from scan implementations.'
  }
]
