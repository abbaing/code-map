import { designStatus } from '#architecture/component-model.mjs'

export const submapComponents = [
  {
    id: 'submap-core',
    responsibility: 'Select, traverse, validate, compare, and identify portable graph subsets.',
    role: 'core',
    files: [
      'submap/create.mjs',
      'submap/create-content.mjs',
      'submap/create-projection.mjs',
      'submap/create-selection.mjs',
      'submap/create-validation.mjs',
      'submap/diff.mjs',
      'submap/digest.mjs',
      'submap/errors.mjs',
      'submap/selector-normalization.mjs',
      'submap/selector-resolution.mjs',
      'submap/selector-validation.mjs',
      'submap/selectors.mjs',
      'submap/strategies.mjs',
      'submap/validate.mjs',
      'submap/validation-content.mjs',
      'submap/validation-graph.mjs',
      'submap/validation-shape.mjs',
      'submap/validation-values.mjs'
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
    files: [
      'submap/cli.mjs',
      'submap/cli-args.mjs',
      'submap/cli-create.mjs',
      'submap/cli-diff.mjs',
      'submap/cli-inspect.mjs',
      'submap/cli-list.mjs',
      'submap/cli-support.mjs',
      'submap/cli-validate.mjs'
    ],
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
