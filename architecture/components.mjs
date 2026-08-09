export const components = [
  {
    id: 'public-api',
    responsibility: 'Expose the supported package entry points without implementing domain behavior.',
    role: 'adapter',
    files: ['index.mjs'],
    contracts: ['PackageExports'],
    compositionRoot: false,
    design: designStatus('pass', 'gap', 'not-applicable', 'pass', 'pass'),
    decision: 'New public capabilities still require editing the barrel export; preserve its inward-only dependencies.'
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
    design: designStatus('pass', 'gap', 'not-applicable', 'pass', 'gap'),
    decision: 'Technology detectors are hard-coded and filesystem access is concrete.'
  },
  {
    id: 'classification',
    responsibility: 'Classify source paths into modules, layers, and architectural types.',
    role: 'core',
    files: ['classify.mjs'],
    contracts: ['SourceClassifier'],
    compositionRoot: false,
    design: designStatus('pass', 'gap', 'not-applicable', 'pass', 'gap'),
    decision: 'Inject ProjectContext and move remaining framework-specific branches behind classifier strategies.'
  },
  {
    id: 'resolution',
    responsibility: 'Resolve configured aliases and local TypeScript or JavaScript imports.',
    role: 'core',
    files: ['resolve.mjs'],
    contracts: ['ImportResolver'],
    compositionRoot: false,
    design: designStatus('pass', 'gap', 'not-applicable', 'pass', 'gap'),
    decision: 'Resolution still reads global configuration and the concrete filesystem.'
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
    role: 'adapter',
    files: ['scan-utils.mjs'],
    contracts: ['SourceReader', 'SourceWalker'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'not-applicable', 'pass', 'gap'),
    decision: 'Pure analysis is isolated; replace direct filesystem access with the source capability.'
  },
  {
    id: 'endpoints',
    responsibility: 'Normalize, extract, match, and connect HTTP endpoint evidence.',
    role: 'core',
    files: ['endpoints.mjs'],
    contracts: ['EndpointAnalyzer'],
    compositionRoot: false,
    design: designStatus('pass', 'gap', 'not-applicable', 'pass', 'pass'),
    decision: 'Extraction patterns require modification for new client conventions; introduce ordered extractors.'
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
    contracts: ['ScanPhase', 'Scanner', 'GraphEnricher'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'gap', 'gap'),
    decision: 'Pipeline phases declare focused inputs and outputs; scanner capabilities still receive a broad context.'
  },
  {
    id: 'frontend-scanner',
    responsibility: 'Extract frontend files, imports, behavior, and endpoint evidence.',
    role: 'extension',
    files: ['scan-front.mjs'],
    contracts: ['Scanner'],
    compositionRoot: false,
    design: designStatus('pass', 'gap', 'pass', 'pass', 'gap'),
    decision: 'The scanner honors the capability contract but still imports concrete classifiers and resolution.'
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
    design: designStatus('gap', 'gap', 'gap', 'pass', 'gap'),
    decision: 'Backend indexes are execution-scoped; split scanner families before adding more backend technologies.'
  },
  {
    id: 'rules',
    responsibility: 'Evaluate configured architectural rules against source evidence.',
    role: 'extension',
    files: ['rules/rule-runner.mjs', 'rules/frontend-guardrails.mjs', 'rules/architecture-guardrails.mjs'],
    contracts: ['Rule'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'gap'),
    decision: 'Rules receive an isolated FindingSink; inject source access before adding more rule families.'
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
    id: 'json-persistence',
    responsibility: 'Persist text and JSON atomically.',
    role: 'adapter',
    files: ['json-io.mjs'],
    contracts: ['TextWriter'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'not-applicable', 'pass', 'gap'),
    decision: 'Keep this as the filesystem adapter and expose it through a port to inward components.'
  },
  {
    id: 'application',
    responsibility: 'Coordinate scan, configuration update, rollback, and trace-submap use cases.',
    role: 'application',
    files: ['server-app.mjs'],
    contracts: ['ServerApplication'],
    compositionRoot: false,
    design: designStatus('pass', 'gap', 'gap', 'pass', 'gap'),
    decision:
      'Inject use cases and persistence ports so a ServerApplication implementation can be substituted in adapters.'
  },
  {
    id: 'http',
    responsibility: 'Adapt local HTTP requests and static assets to application use cases.',
    role: 'composition-root',
    files: ['server.mjs'],
    contracts: ['ServerApplication', 'Route'],
    compositionRoot: true,
    design: designStatus('pass', 'gap', 'not-applicable', 'pass', 'gap'),
    decision: 'Inject the application and route registry instead of closing over a process-wide concrete instance.'
  },
  {
    id: 'cli',
    responsibility: 'Adapt command-line arguments and process IO to application commands.',
    role: 'composition-root',
    files: ['cli.mjs'],
    contracts: ['Command'],
    compositionRoot: true,
    design: designStatus('pass', 'gap', 'not-applicable', 'pass', 'gap'),
    decision: 'Replace flag branching and concrete imports with a command registry assembled at the composition root.'
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
      'submap/validate.mjs'
    ],
    contracts: ['GraphDocument', 'SelectionStrategy', 'TraversalStrategy', 'AccessStrategy'],
    compositionRoot: false,
    design: designStatus('pass', 'gap', 'gap', 'pass', 'pass'),
    decision: 'Extract strategy contracts before adding new selector, traversal, or access variants.'
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
    design: designStatus('pass', 'gap', 'not-applicable', 'pass', 'gap'),
    decision: 'Implement a repository port while keeping filesystem behavior in this adapter.'
  },
  {
    id: 'submap-cli',
    responsibility: 'Adapt submap command-line commands, output, and exit codes.',
    role: 'adapter',
    files: ['submap/cli.mjs', 'submap/cli-args.mjs'],
    contracts: ['Command', 'SubmapRepository'],
    compositionRoot: false,
    design: designStatus('pass', 'gap', 'not-applicable', 'pass', 'gap'),
    decision: 'Register commands and inject IO, repository, git metadata, and output ports.'
  },
  {
    id: 'viewer-state-data',
    responsibility: 'Own browser state, graph loading, filtering, labels, and shared UI utilities.',
    role: 'adapter',
    files: ['viewer/viewer-state.js', 'viewer/viewer-data.js', 'viewer/viewer-utils.js'],
    contracts: ['ViewerStore', 'GraphGateway'],
    compositionRoot: false,
    design: designStatus('gap', 'gap', 'gap', 'gap', 'gap'),
    decision: 'Replace classic-script globals with modules, an encapsulated store, and injected browser gateways.'
  },
  {
    id: 'viewer-trace',
    responsibility: 'Calculate execution traces and trace-focused layouts.',
    role: 'core',
    files: ['viewer/viewer-trace.js'],
    contracts: ['TraceStrategy'],
    compositionRoot: false,
    design: designStatus('pass', 'gap', 'gap', 'gap', 'gap'),
    decision: 'Separate pure trace calculation from state access and layout mutation behind a TraceStrategy.'
  },
  {
    id: 'viewer-rendering',
    responsibility: 'Lay out graph views and render graph primitives as SVG.',
    role: 'adapter',
    files: ['viewer/viewer-graph.js'],
    contracts: ['LayoutStrategy', 'NodeRenderer', 'EdgeRenderer'],
    compositionRoot: false,
    design: designStatus('gap', 'gap', 'gap', 'gap', 'gap'),
    decision: 'Split layouts, simulation, SVG primitives, and view dispatch into substitutable strategies.'
  },
  {
    id: 'viewer-ui',
    responsibility: 'Coordinate browser interactions and render overview, selection, findings, and management views.',
    role: 'composition-root',
    files: [
      'viewer/viewer-actions.js',
      'viewer/viewer-findings.js',
      'viewer/viewer-init.js',
      'viewer/viewer-overview.js',
      'viewer/viewer-selection.js'
    ],
    contracts: ['ViewerStore', 'ViewController', 'GraphGateway'],
    compositionRoot: true,
    design: designStatus('gap', 'gap', 'gap', 'gap', 'gap'),
    decision: 'Make viewer-init the only composition root and split controllers, views, and effects into ES modules.'
  }
]

export const componentStatusValues = ['pass', 'gap', 'not-applicable']
export const componentRoles = ['core', 'application', 'extension', 'adapter', 'composition-root']

function designStatus(responsibility, extensibility, substitution, interfaces, dependencies) {
  return { responsibility, extensibility, substitution, interfaces, dependencies }
}
