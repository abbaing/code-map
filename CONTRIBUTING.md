# Contributing

Thanks for considering a contribution to code-map.

## Development

Requirements:

- Node.js 20 or later
- npm

Run the test suite:

```bash
npm test
```

Rebuild the local viewer utility stylesheet after changing classes in `viewer/`:

```bash
npm run build:viewer-css
```

Commit the generated `viewer/tailwind.css` together with the source change.

Pull requests run the test suite on Node.js 20, 22, and 24 under Linux, plus Node.js 24 under Windows. CI also rejects stale generated viewer styles.

Dependabot checks npm packages and GitHub Actions weekly. Related updates are grouped to keep review noise low. Before merging an automated update, review the upstream release notes and confirm that CI passes. Keep `tailwindcss` and `@tailwindcss/cli` on matching versions.

Validate package contents:

```bash
npm run pack:dry
```

## Pull Requests

- Keep changes focused and explain the user-facing impact.
- Add or update tests for scanner, CLI, config, or viewer behavior changes.
- Do not include repository-specific rules in generic templates.
- Keep code-map local-first; do not add telemetry or network calls.

## Licensing

By contributing, you agree that your contribution is provided under the project's AGPL-3.0-only license. The maintainer may request additional contributor terms if commercial licensing requires it.
