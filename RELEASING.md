# Releasing code-map

Releases are deliberate maintainer operations. CI never receives publishing credentials and this repository does not publish automatically.

## Version policy

code-map follows Semantic Versioning:

- patch releases contain backward-compatible fixes;
- minor releases contain backward-compatible functionality;
- major releases contain incompatible public API, CLI, schema, or persisted-format changes.

Before `1.0.0`, an incompatible change increments the minor version and must be called out under `### Changed` with a **Breaking** prefix. Deprecations must be documented for at least one release before removal whenever practical.

The public contract includes package exports and types, CLI flags and exit codes, JSON Schemas, project-map fields, graph and submap formats, and documented security defaults.

## Release criteria

A release is ready only when:

- the release commit is based on the current default branch and the worktree is clean;
- all required CI jobs pass on the release commit;
- user-facing changes, migrations, deprecations, and security fixes are documented;
- `CHANGELOG.md` has no unreconciled entries and names the intended version and date;
- package and lockfile versions match, and the version does not already exist in npm;
- `npm run release:check` passes without changing tracked files;
- the package contents contain no generated graph, credentials, absolute workspace paths, or unrelated files;
- the maintainer has access to the `@abbaing` npm scope and publishing authentication is configured with 2FA.

## Prepare the release

1. Choose the version according to the policy above.
2. If `package.json` does not already contain the intended version, update `package.json` and `package-lock.json` without creating a tag:

   ```bash
   npm version <version> --no-git-tag-version
   ```

   For the initial `0.1.0` release, the repository already contains the intended version; verify that the lockfile matches instead of running a no-op version command.

3. Move the relevant entries from `Unreleased` to a versioned changelog heading such as `## [0.1.0] - 2026-08-08`. Leave an empty `Unreleased` heading for future work.
4. Run the release gate:

   ```bash
   npm run release:check
   ```

5. Review the package file list printed by `npm pack --dry-run` and inspect `git diff`.
6. Commit the version and changelog, push the commit, and wait for every required CI job to pass.

## Publish

Create and push an annotated tag that exactly matches the package version:

```bash
git tag -a v<version> -m "Released <version>"
git push origin v<version>
```

After tag CI succeeds, publish the scoped package publicly from the tagged commit:

```bash
npm publish --access public
```

Publishing is irreversible for a name/version pair. Confirm the version, npm account, scope, registry, and tarball contents immediately before running the command.

## Verify and announce

Verify the registry metadata and install the published artifact in a temporary project:

```bash
npm view @abbaing/code-map@<version> version dist.integrity
npm install @abbaing/code-map@<version>
npx code-map --help
```

Create a GitHub release from the tag using the matching changelog section. If a release is defective, do not reuse its version: deprecate it when appropriate, fix forward, and publish a new patch release.
