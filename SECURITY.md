# Security Policy

code-map is a local-first development tool. It scans source files and serves a local viewer.

## Reporting Issues

Please report security issues privately to the maintainer through GitHub:

https://github.com/abbaing/code-map/security

If GitHub private vulnerability reporting is unavailable, open a minimal issue asking for a secure contact path. Do not include exploit details in a public issue.

## Scope

Security-sensitive areas include:

- path traversal in the local server,
- unsafe project-map import or plugin loading behavior,
- unintended network access,
- exposure of repository topology or source paths.

## Viewer Hardening

The viewer binds to loopback by default. Mutating requests require a same-origin session, request bodies and connection lifetimes are bounded, and every response includes a restrictive Content Security Policy and defensive browser headers. The packaged viewer does not load remote runtime assets. Viewer-managed source, configuration, graph, submap, alias, runtime-link, and plugin paths are confined to the project root, including through symbolic links.

Custom JavaScript plugins are disabled unless the process starts with `--allow-plugins`. Review every configured module before opting in: plugins run with the same permissions as code-map. The viewer cannot change the trusted plugin list.
