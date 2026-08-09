export const components = [
  {
    id: 'public-api',
    responsibility: 'Expose the supported package entry points without implementing domain behavior.',
    role: 'adapter',
    files: ['index.mjs'],
    contracts: ['PackageExports'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'not-applicable', 'pass', 'pass'),
    decision:
      'Keep supported entry points explicit and extend behavior behind their validated registries and contracts.'
  },
  {
    id: 'graph',
    responsibility: 'Own the in-memory node and edge model.',
    role: 'core',
    files: ['graph.mjs'],
    contracts: ['Graph'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'not-applicable', 'pass', 'pass'),
    decision: 'Graph has no subtype family; consumers rely on its small structural API.'
  },
  {
    id: 'configuration',
    responsibility: 'Validate, normalize, locate, and expose project configuration.',
    role: 'core',
    files: ['config.mjs'],
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
    files: ['detect.mjs'],
    contracts: ['ProjectDetector'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Compose ordered stack detectors over an injected, bounded filesystem capability.'
  },
  {
    id: 'node-detection',
    responsibility: 'Adapt Node filesystem capabilities to project detection.',
    role: 'adapter',
    files: ['detect-node.mjs'],
    contracts: ['ProjectDetector'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'not-applicable', 'pass', 'pass'),
    decision: 'Keep the default Node filesystem selection outside detection policy.'
  },
  {
    id: 'classification',
    responsibility: 'Classify source paths into modules, layers, and architectural types.',
    role: 'core',
    files: ['classify.mjs'],
    contracts: ['SourceClassifier'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Compose ordered classifier strategies over explicit repository paths and ProjectContext.'
  },
  {
    id: 'resolution',
    responsibility: 'Resolve configured aliases and local TypeScript or JavaScript imports.',
    role: 'core',
    files: ['resolve.mjs'],
    contracts: ['ImportResolver'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Compose ordered import strategies over ProjectContext path policy and an injected existence capability.'
  },
  {
    id: 'source-analysis',
    responsibility: 'Analyze source text and repository-relative paths without runtime or filesystem access.',
    role: 'core',
    files: ['source-analysis.mjs'],
    contracts: ['SourceAnalyzer'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep deterministic path, comment, import, and naming analysis independent from source acquisition.'
  },
  {
    id: 'source-files',
    responsibility: 'Provide bounded source reading and deterministic filesystem walking.',
    role: 'core',
    files: ['scan-utils.mjs'],
    contracts: ['SourceReader', 'SourceWalker'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'not-applicable', 'pass', 'pass'),
    decision: 'Keep bounded reads and deterministic walking behind injected filesystem and path capabilities.'
  },
  {
    id: 'endpoints',
    responsibility: 'Normalize, extract, match, and connect HTTP endpoint evidence.',
    role: 'core',
    files: ['endpoints.mjs'],
    contracts: ['EndpointAnalyzer'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Add client conventions as ordered endpoint extractors with shared normalization.'
  },
  {
    id: 'quality',
    responsibility: 'Calculate maintainability signals from an architectural graph.',
    role: 'core',
    files: ['quality.mjs'],
    contracts: ['GraphEnricher'],
    compositionRoot: false,
    design: designStatus('pass', 'gap', 'not-applicable', 'pass', 'gap'),
    decision: 'Inject scoring policy and ProjectContext instead of reading global configuration.'
  },
  {
    id: 'scan-pipeline',
    responsibility: 'Validate and execute ordered scan phases through declared inputs and outputs.',
    role: 'core',
    files: ['scan-pipeline.mjs'],
    contracts: ['ScanPhase'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep phase execution generic, synchronous, deterministic, and independent from scan implementations.'
  },
  {
    id: 'scan-orchestrator',
    responsibility: 'Compose source discovery, scanners, enrichers, and graph serialization.',
    role: 'application',
    files: ['scan.mjs'],
    contracts: ['ScanPhase', 'Scanner', 'GraphEnricher', 'TextWriter'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'gap', 'gap'),
    decision: 'Pipeline phases declare focused inputs and outputs; scanner capabilities still receive a broad context.'
  },
  {
    id: 'node-scan',
    responsibility: 'Compose Node adapters for a direct scan execution.',
    role: 'composition-root',
    files: ['scan-node.mjs'],
    contracts: ['ScanExecution'],
    compositionRoot: true,
    design: designStatus('pass', 'pass', 'not-applicable', 'pass', 'pass'),
    decision: 'Keep executable environment and adapter selection outside the scan application.'
  },
  {
    id: 'frontend-scanner',
    responsibility: 'Extract frontend files, imports, behavior, and endpoint evidence.',
    role: 'extension',
    files: ['scan-front.mjs'],
    contracts: ['Scanner'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Add frontend technologies as registered scanners receiving explicit source capabilities.'
  },
  {
    id: 'backend-analysis-session',
    responsibility: 'Own immutable per-run indexes for backend files, declarations, and implementations.',
    role: 'core',
    files: ['backend-analysis-session.mjs'],
    contracts: ['BackendAnalysisSession'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Expose read-only index queries and keep all indexed data scoped to one scan execution.'
  },
  {
    id: 'backend-scanner',
    responsibility: 'Extract .NET files, controllers, CQRS, dependencies, and persistence evidence.',
    role: 'extension',
    files: ['scan-back.mjs'],
    contracts: ['Scanner', 'BackendAnalysisSession'],
    compositionRoot: false,
    design: designStatus('gap', 'gap', 'gap', 'pass', 'pass'),
    decision: 'Backend indexes are execution-scoped; split scanner families before adding more backend technologies.'
  },
  {
    id: 'rules',
    responsibility: 'Evaluate configured architectural rules against source evidence.',
    role: 'extension',
    files: ['rules/rule-runner.mjs', 'rules/frontend-guardrails.mjs', 'rules/architecture-guardrails.mjs'],
    contracts: ['Rule'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Rules receive isolated finding and source capabilities through registered enrichers.'
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
    responsibility: 'Register, normalize, validate, and compose architectural capabilities.',
    role: 'composition-root',
    files: [
      'templates/architectures.mjs',
      'templates/catalog.mjs',
      'templates/contracts.mjs',
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
    contracts: ['Template', 'Scanner', 'GraphEnricher', 'FileKind'],
    compositionRoot: true,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Validate capabilities at registration and project only their declared required and optional inputs.'
  },
  {
    id: 'persistence-contracts',
    responsibility: 'Validate the minimal capability required to persist text documents.',
    role: 'core',
    files: ['writer-contract.mjs'],
    contracts: ['TextWriter'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep the writing capability structural, immutable, and limited to text persistence.'
  },
  {
    id: 'json-persistence',
    responsibility: 'Persist text and JSON atomically.',
    role: 'adapter',
    files: ['json-io.mjs'],
    contracts: ['TextWriter'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Implement the text writing contract while retaining atomic Node filesystem behavior.'
  },
  {
    id: 'application',
    responsibility: 'Coordinate scan, configuration update, rollback, and trace-submap use cases.',
    role: 'application',
    files: ['server-app.mjs'],
    contracts: ['ServerApplication'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision:
      'Coordinate validated use-case capabilities and expose a frozen application contract to delivery adapters.'
  },
  {
    id: 'node-application-services',
    responsibility: 'Assemble Node-backed scanning, configuration persistence, and submap services.',
    role: 'adapter',
    files: ['server-app-node.mjs'],
    contracts: ['ServerApplicationServices'],
    compositionRoot: false,
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
    files: ['http-routes.mjs'],
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
    files: ['cli-commands.mjs'],
    contracts: ['Command', 'ProjectDetector', 'ScanExecution', 'TemplateCatalog', 'ServerLauncher'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep command matching declarative and receive all runtime operations through focused capabilities.'
  },
  {
    id: 'command-registry',
    responsibility: 'Validate, select, and execute command implementations with normalized exit results.',
    role: 'core',
    files: ['command-registry.mjs'],
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
    design: designStatus('gap', 'pass', 'pass', 'pass', 'gap'),
    decision: 'Replace classic-script globals with modules, an encapsulated store, and injected browser gateways.'
  },
  {
    id: 'viewer-trace',
    responsibility: 'Calculate execution traces and trace-focused layouts.',
    role: 'core',
    files: ['viewer/trace-strategy.mjs', 'viewer/viewer-trace.js'],
    contracts: ['TraceStrategy'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'gap'),
    decision: 'Separate pure trace calculation from state access and layout mutation behind a TraceStrategy.'
  },
  {
    id: 'viewer-rendering',
    responsibility: 'Lay out graph views and render graph primitives as SVG.',
    role: 'adapter',
    files: ['viewer/rendering-contracts.mjs', 'viewer/viewer-graph.js'],
    contracts: ['LayoutStrategy', 'NodeRenderer', 'EdgeRenderer'],
    compositionRoot: false,
    design: designStatus('gap', 'pass', 'pass', 'pass', 'gap'),
    decision: 'Split layouts, simulation, SVG primitives, and view dispatch into substitutable strategies.'
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
