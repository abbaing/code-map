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
- `scan.mjs` orchestrates scanning; specialized scanners extract frontend, backend, endpoint, and quality facts.
- `rules/` evaluates graph and source facts without depending on CLI, HTTP, or the viewer.
- `templates/` extends scanning through small capability objects rather than conditionals in the orchestrator.
- `submap/` keeps selection, traversal, digest, diff, and validation independent from its CLI adapter.
- `server-app.mjs` owns server-facing use cases; `server.mjs` only adapts HTTP and static files.
- `viewer/` consumes the serialized graph and does not reach into Node.js modules.

## Component design policy

- **Cohesion:** split a file only when it owns different reasons to change, not because of line count.
- **Extensibility:** add scanners and enrichers through templates, rules through rule metadata, and submap behavior through its public functions.
- **Behavioral contracts:** capability implementations must honor their registry contracts and return the documented graph data.
- **Minimal capabilities:** public entry points export focused functions; adapters consume only the methods they need.
- **Dependency direction:** delivery adapters depend inward on application/core modules. Core modules never import CLI, HTTP, viewer, or tests.

`tests/architecture.test.mjs` enforces dependency direction, an independent `Graph`, the HTTP/application boundary, and an acyclic production graph.

The complete component inventory, structural contracts, composition roots, current gaps, and Definition of Done are maintained in [COMPONENTS.md](COMPONENTS.md). `tests/component-contracts.test.mjs` ensures every executable production module has exactly one declared component owner.
