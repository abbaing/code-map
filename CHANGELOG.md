# Changelog

All notable changes to code-map are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

### Changed

- Generated graphs use repository-relative paths and omit workstation-specific roots.
- Large source files are skipped with explicit statistics and warnings.

### Security

- Restricted the viewer server to loopback by default and hardened host, origin, session, timeout, and request-size handling.
- Added a restrictive Content Security Policy and removed remote runtime assets and inline JavaScript.
- Confined viewer-managed paths to the project root, including symbolic links.
- Made JSON and configuration persistence atomic and transactional.
- Disabled custom plugin execution unless explicitly enabled with `--allow-plugins`.
