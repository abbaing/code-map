# Contributing

Thanks for considering a contribution to code-map.

## Development

Requirements:

- Node.js 20.9 or later
- npm

Run the complete local quality gate:

```bash
npm run check
```

This runs ESLint, verifies formatting with Prettier, and executes the test suite. Use `npm run format` to apply formatting before committing.

Maintained JS, MJS, TypeScript, C#, CSS, HTML, JSON, and YAML files may not exceed 200 physical lines or contain a
line longer than 200 Unicode characters. JavaScript functions are limited to 60 physical lines, cyclomatic complexity
12, nesting depth 3, and 5 parameters. Generated lockfiles and generated viewer CSS are excluded. Do not satisfy these
limits with empty facades, generic `utils` modules, or by moving unrelated behavior together; split by reason to change
and update component ownership.

Measure the production modules and enforce the repository coverage baseline:

```bash
npm run test:coverage
```

Coverage thresholds are enforced separately for the application, server, submap, viewer, platform, and architecture modules in a dedicated Linux/Node.js 24 CI job. This keeps weaker presentation coverage from masking regressions in the application baseline. New behavior should include regression tests instead of lowering the thresholds.

Rebuild the local viewer utility stylesheet after changing classes in `viewer/`:

```bash
npm run build:viewer-css
```

Commit the generated `viewer/tailwind.css` together with the source change.

Pull requests run static checks and the test suite on Node.js 20, 22, and 24 under Linux, plus Node.js 24 under Windows. CI also rejects stale generated viewer styles.

## Structural boundaries

- Parsers and language adapters publish named facts through `SourceDocumentStore`; scanners must not import parser
  modules, parser packages, syntax trees, or AST APIs directly.
- Executable `*.test.mjs` files contain assertions and may not be imported. Reusable setup belongs in a focused fixture
  or harness module with explicit lifecycle and cleanup.
- Shared policies, contracts, and rendering primitives need a domain-specific name and exactly one component owner.
- Before removing duplication, confirm that both callers share behavior, precedence, errors, and change cadence. Add a
  characterization test, then extract the smallest semantic contract. Do not merge independent adapter glue merely
  because its implementation is textually similar.

Dependabot checks npm packages and GitHub Actions weekly. Related updates are grouped to keep review noise low. Before merging an automated update, review the upstream release notes and confirm that CI passes. Keep `tailwindcss` and `@tailwindcss/cli` on matching versions.

Validate package contents:

```bash
npm run pack:dry
```

Maintainers preparing a version must follow [RELEASING.md](RELEASING.md). The release gate combines static checks, coverage thresholds, generated CSS verification, and package inspection:

```bash
npm run release:check
```

## Pull Requests

- Keep changes focused and explain the user-facing impact.
- Add or update tests for scanner, CLI, config, or viewer behavior changes.
- Assign every new production module to a component and satisfy the Definition of Done in [COMPONENTS.md](COMPONENTS.md).
- Do not add lint suppressions, size exceptions, or maintainability baselines. Refactor the owning responsibility instead.
- In the pull request description, identify any duplicated behavior reviewed and state whether it was consolidated or
  intentionally kept separate because the contracts differ.
- Do not include repository-specific rules in generic templates.
- Keep code-map local-first; do not add telemetry or network calls.

## Licensing

By contributing, you agree that your contribution is provided under the project's AGPL-3.0-only license. The maintainer may request additional contributor terms if commercial licensing requires it.
