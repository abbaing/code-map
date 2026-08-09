# Architecture

`code-map` uses modules and functions instead of class hierarchies. Component design is enforced at module boundaries without a dependency-injection framework.

## Dependency flow

```text
cli.mjs ───────────────┐
server.mjs → server-app.mjs ─┐
                              v
config → scan → Graph → rules/templates
                    └→ submap

graph.json → viewer
```

- `graph.mjs` owns only the in-memory graph model and has no dependencies.
- `scan.mjs` composes an ordered pipeline whose phases declare their required inputs and produced outputs; specialized scanners extract frontend, backend, endpoint, and quality facts.
- Project detection evaluates registered stack detectors over an injected repository inspection capability; `detect-node.mjs` selects the default Node adapter.
- Backend indexes belong to an immutable analysis session created for each scan execution.
- Deterministic source-text and path analysis is isolated from filesystem-backed source acquisition; scanners and rules receive a bounded source reader explicitly.
- Each scan owns a finding collector; rules receive its write capability while graph finalization receives its read capability.
- `rules/` evaluates graph and source facts without depending on CLI, HTTP, or the viewer.
- `templates/` extends scanning through validated capability objects that declare their required and optional inputs.
- `submap/` keeps selection, traversal, access, digest, diff, and validation independent from its CLI adapter; its policies are validated strategies and persistence enters through a repository contract.
- `server-app.mjs` coordinates injected scan, configuration, and submap capabilities; `server.mjs` selects Node adapters and dispatches through a validated route registry.
- `viewer/` consumes the serialized graph and does not reach into Node.js modules.
- `platform/` defines runtime capabilities and contains the Node adapter selected by executable boundaries.
- `cli.mjs` assembles validated command implementations; command selection and exit results are runtime-independent.
- Submap commands share the command registry and receive document input, Git metadata, persistence, and output capabilities.

## Component design policy

- **Cohesion:** split a file only when it owns different reasons to change, not because of line count.
- **Extensibility:** add scanners and enrichers through templates, rules through rule metadata, and submap behavior through its public functions.
- **Behavioral contracts:** capability implementations must honor their registry contracts and return the documented graph data.
- **Minimal capabilities:** public entry points export focused functions; adapters consume only the methods they need.
- **Dependency direction:** delivery adapters depend inward on application/core modules. Core modules never import CLI, HTTP, viewer, or tests.

`tests/architecture.test.mjs` enforces dependency direction, an independent `Graph`, the HTTP/application boundary, browser isolation, and an acyclic production graph. The role matrix and the exact ratcheted set of inherited dependency edges live in `architecture/dependency-policy.mjs`; adding an unapproved edge or retaining a stale exception fails the suite.

The complete component inventory, structural contracts, composition roots, current gaps, and Definition of Done are maintained in [COMPONENTS.md](COMPONENTS.md). `tests/component-contracts.test.mjs` ensures every executable production module has exactly one declared component owner.
