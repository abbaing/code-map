import { designStatus } from '#architecture/component-model.mjs'

export const deliveryComponents = [
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
  }
]
