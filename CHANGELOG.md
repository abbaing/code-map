# Changelog

All notable changes to code-map are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Named submaps now open directly in the graph and can be deleted with their full revision history from the options menu.
- Entity Framework usage analysis now traverses each backend source file once instead of once per entity.

## [0.1.0] - 2026-08-09

### Added

- Local architectural graph generation for frontend and backend source trees.
- Interactive local viewer with execution traces, findings, quality signals, and portable submaps.
- Composable templates, architectural guardrails, JSON Schemas, CLI commands, and a programmatic submap API.
- Cross-platform CI, grouped dependency updates, static quality checks, and coverage regression thresholds.
- A machine-checked component inventory, contract baseline, and Definition of Done.
- Immutable, injectable project contexts that isolate configuration and path resolution between executions.
- Injectable filesystem, environment, clock, hashing, and randomness capabilities with a Node adapter.
- A validated scan pipeline with ordered phases and explicit input/output contracts.
- Execution-scoped backend analysis sessions that prevent index state from leaking between scans.
- Runtime-independent source text and path analysis utilities.
- Per-scan finding collectors with separate rule output and finalized result capabilities.
- Runtime validation and focused input declarations for template capabilities.
- Injectable selection, traversal, and access strategies for portable submaps.
- An injectable submap repository with a filesystem-backed Node implementation.
- A validated server application contract backed by injectable use-case capabilities.
- A validated and injectable HTTP route registry with asynchronous dispatch.
- A validated command registry with injectable CLI runtime capabilities.
- Registered submap commands with injectable document, Git metadata, and output capabilities.

### Changed

- Generated graphs use repository-relative paths and omit workstation-specific roots.
- Large source files are skipped with explicit statistics and warnings.
- CLI help uses the installed `code-map` command instead of an internal repository path.
- The viewer server exposes every browser module required by the rendering graph.
- Module navigation centers and fits the populated graph instead of opening on empty canvas space.
- Database contexts summarize managed entities without drawing a relation to every entity card.
- Shared database contexts no longer expand a module graph through duplicated entity and table usages.
- Selecting a component preserves the module layout while highlighting its execution trace.

### Security

- Restricted the viewer server to loopback by default and hardened host, origin, session, timeout, and request-size handling.
- Added a restrictive Content Security Policy and removed remote runtime assets and inline JavaScript.
- Confined viewer-managed paths to the project root, including symbolic links.
- Made JSON and configuration persistence atomic and transactional.
- Disabled custom plugin execution unless explicitly enabled with `--allow-plugins`.

[Unreleased]: https://github.com/abbaing/code-map/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/abbaing/code-map/releases/tag/v0.1.0
