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
