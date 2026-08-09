# Component architecture policy

code-map applies modular design rules to JavaScript module boundaries and structural contracts. It does not introduce classes or dependency-injection containers solely to imitate object-oriented examples.

The machine-readable component inventory is `architecture/components.mjs`. Every production `.mjs` or `.js` file must have exactly one owner there. `tests/component-contracts.test.mjs` rejects missing files, duplicate ownership, incomplete decisions, invalid contract implementations, and unclassified future modules.

## Status model

Every component records one status for each design quality:

- `pass`: the repository contains enough structural or test evidence;
- `gap`: the component has a known design gap scheduled in the remediation plan;
- `not-applicable`: permitted only for substitution when the component has no implementation family.

`not-applicable` must not be used to avoid defining a contract where interchangeable behavior is intended. A component with an extension contract must eventually prove substitution through a shared contract test.

## Component criteria

### Cohesion and ownership

A component states one responsibility in one sentence. Its files may collaborate, but they must have the same primary reason to change. File length alone is not a violation; mixing policy, orchestration, transport, persistence, and presentation is.

### Extensibility

New variants are added through data, configuration, registration, or a strategy contract. An orchestrator must not require a new conditional branch for every implementation. Closed domain invariants remain explicit and validated.

### Behavioral contracts

Every implementation of a named contract accepts the same input invariants, produces the same output shape, preserves documented side effects, and reports failures through the same error contract. Shared tests run against every implementation.

### Minimal capabilities

Consumers receive only the operations and data they use. Broad mutable context objects, process-wide globals, barrel imports used as service locators, and shared browser globals are prohibited. Read and write capabilities are separated when consumers need only one direction.

### Dependency direction

Core and application modules depend on domain contracts. Platform APIs and concrete adapters are selected only at composition roots. Passing a concrete dependency through a small structural port is sufficient; a container or class hierarchy is not required.

## Target ports and contracts

Contracts are structural JavaScript objects or functions. Their exact signatures will be introduced with the component that first implements them.

`ProjectContext` is created once at a composition root, deeply freezes its normalized project map, owns repository-relative path resolution, and is passed explicitly to every scan or application execution. Loading another project creates an independent context and cannot alter an existing execution. Runtime access is provided through validated capabilities rather than ambient process state.

| Contract                        | Minimum responsibility                                                          |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `ProjectContext`                | Immutable normalized configuration and repository-relative path policy          |
| `ProjectDetector`               | Compose ordered stack detectors over bounded repository inspection              |
| `FileSystemPort`                | Bounded reads, walking, existence, canonical paths, and atomic writes           |
| `TextWriter`                    | Atomically persist a text document at a requested path                          |
| `EnvironmentPort`               | Working directory, arguments, environment values, and process exit boundary     |
| `ClockPort`                     | Current timestamp generation                                                    |
| `HashPort`                      | Stable SHA-256 digest generation                                                |
| `RandomPort`                    | UUID and cryptographically secure token generation                              |
| `Graph` / `GraphDocument`       | In-memory graph operations and serialized graph shape                           |
| `SourceClassifier`              | Classify one repository-relative source path                                    |
| `SourceAnalyzer`                | Analyze source text and normalized paths without external state                 |
| `SourceReader`                  | Read bounded source text through an injected filesystem capability              |
| `ImportResolver`                | Resolve one import from a source file                                           |
| `ScanPhase`                     | Transform declared scan inputs into declared outputs in an ordered pipeline     |
| `Scanner`                       | Add one bounded category of evidence to a scan session                          |
| `BackendAnalysisSession`        | Query backend files, declarations, and implementations for one scan execution   |
| `GraphEnricher`                 | Derive metadata from an already populated graph                                 |
| `Rule`                          | Evaluate one policy against a documented rule context                           |
| `FindingSink` / `FindingSource` | Write findings or read finalized findings, never both by default                |
| `Template`                      | Compose named file kinds, scanners, enrichers, rules, and presentation metadata |
| `SelectionStrategy`             | Resolve submap seed or exclusion node identifiers                               |
| `TraversalStrategy`             | Traverse eligible graph relationships under a bounded policy                    |
| `AccessStrategy`                | Resolve access classifications and conflicts                                    |
| `SubmapRepository`              | Read, list, and atomically write graph subset documents                         |
| `ServerApplication`             | Scan, read configuration, update configuration, and create trace submaps        |
| `Command`                       | Execute parsed command input through injected ports and return an exit result   |
| `Route`                         | Match one HTTP request and adapt it to an application operation                 |
| `ViewerStore`                   | Read, update, and subscribe to browser application state                        |
| `GraphGateway`                  | Load and mutate viewer-facing graph resources                                   |
| `TraceStrategy`                 | Calculate node, module, and system traces from explicit graph inputs            |
| `LayoutStrategy`                | Produce positions for one graph view without touching the DOM                   |
| `NodeRenderer` / `EdgeRenderer` | Render one supported graph primitive                                            |
| `ViewController`                | Bind one view's interactions to store operations and effects                    |

Ports must remain capability-oriented. A new method is added only when every consumer of that port needs it; otherwise a new smaller port is introduced.

## Composition roots

Concrete dependencies may be assembled only in these locations:

- `cli.mjs`: root CLI commands and Node adapters;
- `server.mjs`: HTTP routes, server application, security policy, and Node HTTP adapter;
- `scan-node.mjs`: direct Node scan execution and adapter selection;
- `templates/registry.mjs`: ordered template and capability composition;
- `viewer/viewer-init.js`: browser store, gateways, controllers, and render strategies;
- tests: fakes, fixtures, clocks, and failure adapters.

Composition roots may import concrete adapters. They must not contain domain policy beyond validation required to assemble a safe application.

## Definition of Done

A new or materially changed component is complete only when:

1. it appears in `components` with one responsibility and exact file ownership;
2. responsibility, extensibility, interfaces, and dependencies are `pass` and backed by reviewable evidence;
3. substitution is `pass` with shared contract tests, or `not-applicable` with a concrete rationale;
4. dependencies enter through parameters or immutable context rather than hidden global state;
5. platform imports exist only in adapters or composition roots;
6. extension points reject malformed implementations before execution;
7. architecture, contract, behavior, and coverage tests pass;
8. documentation names any public contract or compatibility impact.

S17 will turn the target dependency rules into automated fitness functions, and S18 will close the remaining controlled gaps before requiring every applicable status to be `pass`.
