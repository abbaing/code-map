export const components = [
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
    files: ['src/core/graph.mjs'],
    contracts: ['Graph'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'not-applicable', 'pass', 'pass'),
    decision: 'Graph has no subtype family; consumers rely on its small structural API.'
  },
  {
    id: 'configuration',
    responsibility: 'Validate, normalize, locate, and expose project configuration.',
    role: 'core',
    files: ['src/core/config.mjs'],
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
    files: ['src/core/detect.mjs'],
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
    files: ['src/core/classify.mjs'],
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
    responsibility: 'Adapt Tree-sitter C# syntax and declarations to the language-neutral parser contract.',
    role: 'adapter',
    files: ['src/adapters/parsers/csharp.mjs'],
    contracts: ['Parser'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Contain Tree-sitter and C# syntax conventions as an optional registered language feature.'
  },
  {
    id: 'source-files',
    responsibility: 'Provide bounded source reading and deterministic filesystem walking.',
    role: 'core',
    files: ['src/core/scan-utils.mjs'],
    contracts: ['SourceReader', 'SourceWalker'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'not-applicable', 'pass', 'pass'),
    decision: 'Keep bounded reads and deterministic walking behind injected filesystem and path capabilities.'
  },
  {
    id: 'quality',
    responsibility: 'Calculate maintainability signals from an architectural graph.',
    role: 'core',
    files: ['src/core/quality.mjs'],
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
  },
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
    files: ['src/core/backend-analysis-session.mjs'],
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
  },
  {
    id: 'persistence-contracts',
    responsibility: 'Validate the minimal capability required to persist text documents.',
    role: 'core',
    files: ['src/core/writer-contract.mjs'],
    contracts: ['TextWriter'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep the writing capability structural, immutable, and limited to text persistence.'
  },
  {
    id: 'json-persistence',
    responsibility: 'Persist text and JSON atomically.',
    role: 'adapter',
    files: ['src/adapters/node/json-io.mjs'],
    contracts: ['TextWriter'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Implement the text writing contract while retaining atomic Node filesystem behavior.'
  },
  {
    id: 'application',
    responsibility: 'Coordinate scan, configuration update, rollback, and trace-submap use cases.',
    role: 'application',
    files: ['src/application/server-app.mjs'],
    contracts: ['ServerApplication'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision:
      'Coordinate validated use-case capabilities and expose a frozen application contract to delivery adapters.'
  },
  {
    id: 'node-application-services',
    responsibility: 'Assemble Node-backed scanning, configuration persistence, and submap services.',
    role: 'composition-root',
    files: ['src/adapters/node/server-app-node.mjs'],
    contracts: ['ServerApplicationServices'],
    compositionRoot: true,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep concrete service selection outside the application and expose only its declared capabilities.'
  },
  {
    id: 'http',
    responsibility: 'Adapt local HTTP requests and static assets to application use cases.',
    role: 'composition-root',
    files: ['server.mjs'],
    contracts: ['ServerApplication', 'Route'],
    compositionRoot: true,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Assemble secure default routes and accept validated application and route registry implementations.'
  },
  {
    id: 'http-routing',
    responsibility: 'Define, validate, and resolve transport route implementations.',
    role: 'core',
    files: ['src/core/http-routes.mjs'],
    contracts: ['Route', 'RouteRegistry'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep route matching independent from Node HTTP and validate extensions before server startup.'
  },
  {
    id: 'cli',
    responsibility: 'Adapt command-line arguments and process IO to application commands.',
    role: 'composition-root',
    files: ['cli.mjs'],
    contracts: ['Command', 'ProjectDetector', 'ScanExecution', 'TemplateCatalog', 'ServerLauncher'],
    compositionRoot: true,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Assemble validated command implementations with Node platform and repository adapters.'
  },
  {
    id: 'cli-commands',
    responsibility: 'Implement root command-line use cases through injected runtime capabilities.',
    role: 'adapter',
    files: ['src/application/cli-commands.mjs'],
    contracts: ['Command', 'ProjectDetector', 'ScanExecution', 'TemplateCatalog', 'ServerLauncher'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep command matching declarative and receive all runtime operations through focused capabilities.'
  },
  {
    id: 'command-registry',
    responsibility: 'Validate, select, and execute command implementations with normalized exit results.',
    role: 'core',
    files: ['src/core/command-registry.mjs'],
    contracts: ['Command', 'CommandRegistry'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep command dispatch ordered, runtime-independent, and strict about result contracts.'
  },
  {
    id: 'submap-core',
    responsibility: 'Select, traverse, validate, compare, and identify portable graph subsets.',
    role: 'core',
    files: [
      'submap/create.mjs',
      'submap/diff.mjs',
      'submap/digest.mjs',
      'submap/errors.mjs',
      'submap/selectors.mjs',
      'submap/strategies.mjs',
      'submap/validate.mjs'
    ],
    contracts: ['GraphDocument', 'SelectionStrategy', 'TraversalStrategy', 'AccessStrategy'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Compose validated selection, traversal, and access strategies while retaining core invariants.'
  },
  {
    id: 'submap-api',
    responsibility: 'Expose portable submap operations with Node runtime defaults at the public boundary.',
    role: 'composition-root',
    files: ['submap/index.mjs'],
    contracts: ['GraphDocument', 'ClockPort', 'HashPort'],
    compositionRoot: true,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep runtime defaults here while core submap modules require explicit capabilities.'
  },
  {
    id: 'submap-io',
    responsibility: 'Read, list, and atomically persist graph and submap documents.',
    role: 'adapter',
    files: ['submap/io.mjs'],
    contracts: ['SubmapRepository'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Provide the frozen Node repository while keeping filesystem behavior contained in this adapter.'
  },
  {
    id: 'submap-repository-contract',
    responsibility: 'Validate the minimal persistence capability required by submap consumers.',
    role: 'core',
    files: ['submap/repository.mjs'],
    contracts: ['SubmapRepository'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep the repository contract structural and verify implementations with a shared behavior suite.'
  },
  {
    id: 'submap-cli',
    responsibility: 'Adapt submap command-line commands, output, and exit codes.',
    role: 'adapter',
    files: ['submap/cli.mjs', 'submap/cli-args.mjs'],
    contracts: ['Command', 'SubmapRepository'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision:
      'Dispatch registered commands through injected document, repository, metadata, platform, and output ports.'
  },
  {
    id: 'node-submap-cli',
    responsibility: 'Adapt Node stdin, process output, and Git metadata to submap command capabilities.',
    role: 'adapter',
    files: ['submap/cli-node.mjs'],
    contracts: ['DocumentInput', 'GitMetadata', 'CommandOutput'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep process and child-process access outside command implementations and expose frozen capabilities.'
  },
  {
    id: 'viewer-state-data',
    responsibility: 'Own browser state, graph loading, filtering, labels, and shared UI utilities.',
    role: 'adapter',
    files: [
      'viewer/graph-gateway.mjs',
      'viewer/viewer-state.js',
      'viewer/viewer-store.mjs',
      'viewer/viewer-data.js',
      'viewer/viewer-utils.js'
    ],
    contracts: ['ViewerStore', 'GraphGateway'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep state store-owned and route browser effects through explicitly configured module boundaries.'
  },
  {
    id: 'viewer-trace',
    responsibility: 'Calculate execution traces and trace-focused layouts.',
    role: 'core',
    files: ['viewer/trace-strategy.mjs', 'viewer/viewer-trace.js'],
    contracts: ['TraceStrategy'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep trace calculation pure by passing graph data, visible nodes, labels, and view mode explicitly.'
  },
  {
    id: 'viewer-rendering',
    responsibility: 'Lay out graph views and render graph primitives as SVG.',
    role: 'adapter',
    files: [
      'viewer/rendering-contracts.mjs',
      'viewer/viewer-graph.js',
      'viewer/viewer-layouts.js',
      'viewer/viewer-svg.js'
    ],
    contracts: ['LayoutStrategy', 'NodeRenderer', 'EdgeRenderer'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep view coordination, layout algorithms, and SVG primitives in focused registered modules.'
  },
  {
    id: 'viewer-ui',
    responsibility: 'Coordinate browser interactions and render overview, selection, findings, and management views.',
    role: 'composition-root',
    files: [
      'viewer/view-controller.mjs',
      'viewer/viewer-actions.js',
      'viewer/viewer-findings.js',
      'viewer/viewer-init.js',
      'viewer/viewer-interactions.mjs',
      'viewer/viewer-overview.js',
      'viewer/viewer-selection.js'
    ],
    contracts: ['ViewerStore', 'ViewController', 'ViewerUiController', 'GraphGateway'],
    compositionRoot: true,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep viewer-init as the composition root and inject browser capabilities into the UI controller.'
  }
]

export const componentStatusValues = ['pass', 'gap', 'not-applicable']
export const componentRoles = ['core', 'application', 'extension', 'adapter', 'composition-root']

function designStatus(responsibility, extensibility, substitution, interfaces, dependencies) {
  return { responsibility, extensibility, substitution, interfaces, dependencies }
}
