# Architecture

`code-map` uses modules and functions instead of class hierarchies. Component design is enforced at module boundaries
without a dependency-injection framework.

## Dependency flow

```text
cli.mjs ------------------------------+
server.mjs -> application/server-app -+-> core -> rules/templates
config -> scan -----------------------+          +-> submap

graph.json -> viewer
```

- `src/core/graph.mjs` owns only the in-memory graph model and has no dependencies.
- `src/application/scan.mjs` composes an ordered pipeline whose phases declare required inputs and produced outputs;
  only immutable named scanner results cross into enrichment.
- Project detection evaluates registered stack detectors over an injected repository inspection capability;
  `src/adapters/node/detect-node.mjs` selects the default Node adapter.
- Backend indexes belong to an immutable analysis session created for each scan execution.
- Backend classification, constructor dependencies, HTTP requests, persistence facts, and session construction are
  independent scanner families. `src/scanners/scan-back.mjs` is a compatibility-only facade.
- Deterministic source analysis is isolated from filesystem-backed source acquisition. Discovery and bounded reads use
  project-scoped filesystem and path capabilities without ambient runtime access.
- Each scan owns a finding collector; rules receive its write capability while finalization receives its read capability.
- `rules/` evaluates graph and source facts without depending on CLI, HTTP, or the viewer.
- `templates/` extends scanning through validated capability objects that declare required and optional inputs.
- Executable and public composition boundaries build the effective template registry before invoking the scan pipeline.
- `submap/` keeps selection, traversal, access, digest, diff, and validation independent from its CLI adapter;
  persistence enters through a repository contract.
- `src/application/server-app.mjs` coordinates injected scan, configuration, and submap capabilities. `server.mjs`
  selects Node adapters and dispatches through a validated route registry.
- `viewer/` consumes the serialized graph and does not reach into Node.js modules.
- `platform/` defines runtime capabilities and contains the Node adapter selected by executable boundaries.
- `cli.mjs` assembles validated commands and runtime-independent command selection and exit results.

## Component design policy

- **Cohesion:** every module owns one reason to change and stays within enforced size and complexity limits. Empty
  facades, generic utility dumping grounds, and relocating mixed responsibilities are prohibited.
- **Extensibility:** add scanners and enrichers through templates, rules through rule metadata, and submap behavior
  through its public strategies and functions.
- **Behavioral contracts:** capability implementations honor registry contracts and return documented graph data.
- **Minimal capabilities:** public entry points export focused functions; adapters consume only the methods they need.
- **Dependency direction:** delivery adapters depend inward on application/core modules. Core modules never import CLI,
  HTTP, viewer, or tests.

`tests/architecture.test.mjs` enforces dependency direction, an independent `Graph`, the HTTP/application boundary,
browser isolation, and an acyclic production graph. The role matrix lives in `architecture/dependency-policy.mjs`;
every dependency-direction violation fails immediately, without exception lists or baselines.

`tests/code-standards.test.mjs` enforces source size and line length for every maintained machine-readable file. ESLint
enforces bounded function size, complexity, nesting, and parameters. These limits are errors with no suppressions,
exception inventory, or inherited baseline.

The complete component inventory, structural contracts, composition roots, and Definition of Done are maintained in
[COMPONENTS.md](COMPONENTS.md). `tests/component-contracts.test.mjs` ensures every executable production module has
exactly one declared component owner.
