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
    files: [
      'src/application/server-app.mjs',
      'src/application/server-contracts.mjs',
      'src/application/server-input.mjs'
    ],
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
    files: [
      'server.mjs',
      'src/delivery/http-body.mjs',
      'src/delivery/http-response.mjs',
      'src/delivery/http-routes.mjs',
      'src/delivery/http-security.mjs',
      'src/delivery/http-server.mjs',
      'src/delivery/viewer-assets.mjs'
    ],
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
    files: [
      'src/application/cli-commands.mjs',
      'src/application/cli-contracts.mjs',
      'src/application/cli-handlers.mjs',
      'src/application/cli-project.mjs'
    ],
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
  }
]
