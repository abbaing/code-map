# code-map

[![CI](https://github.com/abbaing/code-map/actions/workflows/ci.yml/badge.svg)](https://github.com/abbaing/code-map/actions/workflows/ci.yml)

**Explore how your codebase is connected, find architectural drift, and understand the impact of a change.**

code-map scans React and .NET source trees and turns them into a local, interactive dependency graph. It highlights boundary violations, coupling hotspots, orphaned files, missing test signals, and frontend-to-backend execution paths without building or instrumenting the application.

[Quick start](#quick-start) · [Supported stacks](#supported-stacks) · [Configuration](#project-mapjson) · [CLI](#cli) · [Submaps](#submaps)

## Quick start

Requires Node.js 20 or later and has no runtime dependencies.

```bash
npm install --save-dev @abbaing/code-map
npx code-map --init
npx code-map --config my-app.project-map.json
```

Open `http://localhost:1133` to inspect the graph. Everything runs locally; source code and graph data never leave your machine.

## What you get

| Capability         | What it provides                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| Architecture graph | A navigable view of files, modules, layers, and their relationships.                                 |
| Findings           | Boundary violations, cross-feature imports, oversized components, and other configurable rules.      |
| Quality signals    | Explainable cohesion, coupling, orphan, and test-presence indicators.                                |
| Execution traces   | Focused paths from React routes and components to .NET endpoints, handlers, persistence, and tables. |
| Portable submaps   | Bounded graph slices for reviews, automation, and external tools.                                    |
| Local viewer       | A loopback-only interface with no telemetry or hosted service.                                       |

## Why code-map

**For tech leads**

- Enforce layer boundaries with findings on every scan.
- See which modules are accumulating coupling and cohesion problems.
- Catch architectural drift during review, before it becomes established structure.

**For developers**

- Understand where a file sits before changing it.
- Find orphaned files, duplicated responsibilities, and missing test signals.
- Explore the likely impact of a change without running the application.

## How it works

code-map performs static analysis over supported source trees. Its React and .NET templates read imports, classify files by architectural role, match frontend calls to backend endpoints, and calculate cohesion and coupling signals. Files larger than 2 MiB are skipped and reported in the generated graph warnings.

The executable support matrix and known heuristic limits are documented in [ANALYSIS.md](ANALYSIS.md).

The scan produces `.code-map/graph.json` and serves the viewer on port `1133`. Discovered paths remain repository-relative, and generated graphs do not contain code-map's workspace path.

### React + .NET execution traces

In the graph, selecting a frontend component highlights its primary path through routes, views, supporting hooks, API clients, the backend action, CQRS request and handler, services or repositories, the EF entity, and the database table. Unrelated nodes remain visible at low opacity. Use **Show all paths** when the selected component reaches multiple endpoints or tables.

Selecting a table performs the same analysis in reverse to show the frontend routes that can reach it. Solid lines are confirmed relationships; dashed lines are inferred by static analysis. Controller classes remain available in the full graph, while focused traces describe the controller action on the endpoint card instead of adding an extra implementation-detail step.

The viewer's **Management → Create submap from trace** action writes the current trace to `project.submapsDirectory` as a portable submap.

Quality badges use `Q n/10`. Q is a maintainability heuristic derived from cohesion and coupling, not correctness or coverage. Expand **How this score is calculated** in the selected-component inspector to see the formula and exact relation counts used for that node.

## Supported stacks

Specialized source analysis currently covers:

- React frontends written in JavaScript or TypeScript, including routes, components, hooks, imports, tests, and HTTP calls.
- .NET APIs written in C#, including controllers, CQRS requests and handlers, services, repositories, Entity Framework entities, and tables.
- React repositories without a backend, with `sourceRoots.backend` omitted.

Project detection can recognize Vue, Angular, Node.js, Go, and Python markers to report the discovered stack and propose repository structure. Recognition does not enable a specialized source analyzer for those stacks. Add a trusted custom template when a repository needs capabilities beyond React and .NET.

## Configuration discovery

`npx code-map --init` detects source roots, import aliases, and modules, then writes a `<project>.project-map.json` in the current directory. Review `sourceRoots`, `modules.labels`, and `imports.aliases` before the first scan.

You can also run `npx code-map` without a config. It first discovers `project-map.json` or `*.project-map.json` in the repository root and `.code-map`; when none exists, code-map auto-detects the repository and writes `.code-map/graph.json`. After a successful scan, a legacy root `graph.json` is removed only when its structure identifies it as generated code-map output. Use `--init` when you want a committed, reviewable config. The packaged preset in `presets/starter.project-map.json` is only a starter template.

The config can live anywhere in your repository:

```bash
npx code-map --config code-map/project-map.json
CODE_MAP_CONFIG=code-map/project-map.json npx code-map --scan
```

Plugin paths in `templates.plugins` are resolved relative to the `project-map.json` file and execute only with `--allow-plugins`. Source roots remain repository-relative. A bare `project.graphOutput` filename is written beside the config, so a config stored in `.code-map` with `"graphOutput": "graph.json"` produces `.code-map/graph.json`; output paths containing directories remain repository-relative.

## Recommended React + .NET setup

This is the clean setup when the project owns only its config, optional local rules, and package scripts.

### 1. Install the tool

```bash
npm install --save-dev @abbaing/code-map
```

### 2. Generate an initial config

From the repository root:

```bash
npx code-map --init --out code-map
```

This writes a detected config such as `code-map/my-app.project-map.json`. Rename it if you want a stable path:

```txt
code-map/project-map.json
```

### 3. Review the important paths

```json
{
  "project": {
    "name": "My App",
    "graphOutput": "code-map/graph.json",
    "runtimeLinks": "code-map/runtime-links.json",
    "submapsDirectory": "code-map/submaps"
  },
  "sourceRoots": {
    "frontend": "front/src",
    "backend": "back"
  }
}
```

`sourceRoots.frontend` is required. `sourceRoots.backend` is optional. `graphOutput` is generated by scans. `runtimeLinks` is where you can add relationships static analysis cannot infer. `submapsDirectory` stores portable partial graphs created for external tools and automation.

### 4. Create runtime links

```json
{
  "links": []
}
```

Save it at the path configured in `project.runtimeLinks`, for example:

```txt
code-map/runtime-links.json
```

### 5. Add package scripts

```json
{
  "scripts": {
    "codemap": "code-map --config code-map/project-map.json",
    "codemap:scan": "code-map --scan --config code-map/project-map.json"
  }
}
```

### 6. Ignore the generated graph

```gitignore
code-map/graph.json
```

Commit the config. Usually do not commit `graph.json`; it contains your repository topology and is regenerated on demand.

### 7. Scan and open the viewer

```bash
npm run codemap:scan
npm run codemap
```

Open `http://localhost:1133`.

### 8. Add local rules when needed

Example files:

```txt
code-map/templates/my-guardrails.mjs
code-map/rules/my-guardrails.mjs
```

Load the plugin from `project-map.json`:

```json
{
  "templates": {
    "enabled": [
      "filesystem",
      "typescript",
      "react",
      "architecture.feature-sliced",
      "architecture.mvvm",
      "http-endpoints",
      "dotnet-api",
      "architecture.mvc",
      "architecture.clean-architecture",
      "architecture.cqrs",
      "entity-framework",
      "coverage",
      "my-guardrails",
      "quality"
    ],
    "plugins": ["./templates/my-guardrails.mjs"]
  }
}
```

Then start with explicit trust:

```bash
npm run codemap -- --allow-plugins
```

Plugins are resolved relative to `project-map.json`. Review them before starting code-map with `--allow-plugins`; plugin modules execute with the same filesystem and process permissions as code-map. Source roots and runtime links are repository-relative. A bare `project.graphOutput` filename is resolved beside the config; paths containing directories are repository-relative.

## CLI

```
code-map                          Scan and serve the viewer
code-map --config <path>          Use a specific project-map.json
code-map --init                   Auto-detect and write project-map.json
code-map --init --out <dir>       Write to a specific directory
code-map --scan                   Scan only, no viewer
code-map --scan --config <path>   Scan with a specific config, no viewer
code-map --allow-plugins          Trust and execute configured plugin modules
code-map --templates              List available templates
code-map submap --help            Show partial graph commands
code-map --help                   Show help
```

| Variable          | Default     | Description                                      |
| ----------------- | ----------- | ------------------------------------------------ |
| `CODE_MAP_CONFIG` | none        | Path to project-map.json                         |
| `CODE_MAP_HOST`   | `127.0.0.1` | Viewer server host; override only when necessary |
| `CODE_MAP_PORT`   | `1133`      | Viewer server port                               |

The viewer is intended as a local development tool. Mutating HTTP requests require a same-origin browser session, requests with an unexpected `Host` header are rejected, and request bodies are limited to 1 MiB. HTTP connections and requests use bounded timeouts. Setting `CODE_MAP_HOST` to a non-loopback address should only be done on a trusted network; it does not turn the viewer into a public multi-user service.

## project-map.json

The config file controls what gets scanned, how files are classified, and which rules run. `--init` generates one. You own it from there.

```json
{
  "schemaVersion": 1,
  "project": {
    "name": "My App",
    "graphOutput": ".code-map/graph.json",
    "submapsDirectory": ".code-map/submaps"
  },
  "sourceRoots": {
    "frontend": "src",
    "backend": "api"
  },
  "imports": {
    "aliases": [{ "prefix": "@/", "path": "src" }]
  },
  "modules": {
    "shared": "shared",
    "frontendFeaturePattern": "^src/features/([^/]+)",
    "labels": {
      "auth": "Auth",
      "dashboard": "Dashboard"
    }
  },
  "templates": {
    "enabled": ["filesystem", "typescript", "react", "coverage", "quality"]
  }
}
```

## Templates

Compose capability sets in `templates.enabled`. Order matters: later templates extend earlier ones.

| Template                          | Adds                                         |
| --------------------------------- | -------------------------------------------- |
| `filesystem`                      | File discovery, ignored dirs                 |
| `typescript`                      | Import graph, alias resolution, TS rules     |
| `react`                           | Component classification, React rules        |
| `http-endpoints`                  | Frontend to backend endpoint matching        |
| `dotnet-api`                      | .NET controllers, handlers, CQRS             |
| `entity-framework`                | EF entities, DbSet, table mappings           |
| `coverage`                        | Test file detection, coverage metadata       |
| `quality`                         | Cohesion/coupling scores, orphan detection   |
| `architecture.feature-sliced`     | Feature-slice module boundaries              |
| `architecture.mvvm`               | View + hook/controller separation            |
| `architecture.mvc`                | Controller-based request entry               |
| `architecture.clean-architecture` | API/Application/Domain/Infrastructure layers |
| `architecture.cqrs`               | Query/command/handler separation             |

### Custom templates

Define your own architectural rules and load them as plugins:

```json
{
  "templates": {
    "enabled": ["filesystem", "typescript", "react", "my-rules"],
    "plugins": ["./templates/my-rules.mjs"]
  }
}
```

Plugin paths are relative to the `project-map.json` file. They are disabled by default because JavaScript plugins execute with the same permissions as code-map. Review the modules and pass `--allow-plugins` when you intend to trust them. The viewer cannot add, remove, or replace trusted plugin paths; edit the file directly and restart after review.

## Rules

Rules run after the scan and attach findings to graph nodes.

```json
{
  "rules": {
    "enabled": ["technology.typescript.no-any", "framework.react.component-max-lines"],
    "options": {
      "framework.react.component-max-lines": { "max": 200 }
    }
  }
}
```

| Rule                                     | Flags                                               |
| ---------------------------------------- | --------------------------------------------------- |
| `technology.typescript.relative-imports` | `./` or `../` imports under the frontend root       |
| `technology.typescript.no-any`           | `any` and `as any` in frontend source               |
| `framework.react.component-max-lines`    | Component files over the configured line limit      |
| `framework.react.route-file-shape`       | Lazy loading or Suspense inside feature route files |

Suppress known findings without removing them from the report:

```json
{
  "rules": {
    "suppressions": [
      {
        "ruleId": "technology.typescript.no-any",
        "pathPattern": "src/legacy/",
        "reason": "Tracked before migration."
      }
    ]
  }
}
```

## Submaps

Submaps are portable, self-contained partial views derived from `.code-map/graph.json`. They are intended for automation, CI, code review tools, and external agent orchestrators that need a bounded repository context without loading the complete graph.

Submaps are stored separately from the source graph. By default, generated files use a content-addressed name under `.code-map/submaps`:

```txt
.code-map/submaps/auth-refresh@a41bd90c.submap.json
```

Every submap contains:

- a logical `id` and immutable SHA-256 `uid`;
- the digest of the source graph;
- normalized selectors and traversal options;
- complete selected nodes and edges;
- findings and orphan metadata for included nodes;
- explicit access classifications;
- perimeter boundaries for relationships leaving the selection.

`id` is the stable human-readable identity. `uid` is an immutable content digest. Revised artifacts can retain the same `id` and declare `revision` plus `parentUid`, producing a traceable lineage without modifying the previous file.

Create a submap from explicit nodes:

```bash
code-map submap create auth-refresh \
  --graph .code-map/graph.json \
  --node "file:src/auth/RefreshTokenService.ts" \
  --direction both \
  --depth 2 \
  --editable-path "src/auth/**"
```

Selectors are also available for paths, modules, layers, and node types:

```bash
code-map submap create auth-services \
  --graph .code-map/graph.json \
  --module auth \
  --layer application \
  --type service \
  --exclude-module billing
```

Values inside one attribute category use OR. Different attribute categories use AND. Direct node and path selectors are unioned with the attribute query. Seeds have depth `0`; the default traversal is `both` with depth `1`.

### Request files and stdout

For repeatable integrations, pass a request document:

```json
{
  "id": "auth-refresh",
  "selectors": {
    "nodeIds": ["file:src/auth/RefreshTokenService.ts"],
    "paths": ["tests/auth/**"]
  },
  "traversal": {
    "direction": "both",
    "maxDepth": 2,
    "edgeTypes": ["imports", "calls-api"]
  },
  "access": {
    "default": "readable",
    "editable": { "paths": ["src/auth/**", "tests/auth/**"] },
    "forbidden": { "modules": ["billing"] }
  }
}
```

Produce clean JSON on stdout:

```bash
code-map submap create --graph .code-map/graph.json --spec request.json --stdout --quiet
```

Read a request from stdin:

```bash
code-map submap create --graph .code-map/graph.json --spec - --stdout
```

In stdout mode, the artifact is written to stdout and diagnostics are written to stderr. Add `--json-errors` for structured error objects. Submap commands never prompt; `--non-interactive` is accepted when an orchestrator wants to assert that contract explicitly.

### Inspect, validate, diff, and list

```bash
code-map submap inspect .code-map/submaps/auth-refresh@a41bd90c.submap.json

code-map submap validate .code-map/submaps/auth-refresh@a41bd90c.submap.json \
  --against .code-map/graph.json

code-map submap diff auth-refresh-v1.submap.json auth-refresh-v2.submap.json --json

code-map submap list --dir .code-map/submaps --json
```

Validation without `--against` checks internal consistency, IDs, access classifications, edge endpoints, statistics, and the content UID. Validation against a graph additionally checks its digest and source references.

### Programmatic API

The package validates graph topology at scan output and before submap operations. The submap entry exposes pure graph operations alongside explicit Node.js filesystem helpers such as `readGraph` and `writeSubmap`:

```js
import { createSubmap, readGraph, validateSubmap, writeSubmap } from '@abbaing/code-map/submap'

const graph = readGraph('.code-map/graph.json')
const submap = createSubmap(graph, {
  id: 'auth-refresh',
  selectors: { nodeIds: ['file:src/auth/RefreshTokenService.ts'] },
  traversal: { direction: 'both', maxDepth: 2 },
  access: {
    default: 'readable',
    editable: { paths: ['src/auth/**'] }
  }
})

const validation = validateSubmap(submap)
if (validation.valid) writeSubmap('.code-map/submaps/auth-refresh.submap.json', submap)
```

Use `validateGraphDocument` from the root package to validate externally supplied graphs explicitly. Public JSON Schemas are exported at `@abbaing/code-map/schemas/graph`, `@abbaing/code-map/schemas/project-map`, `@abbaing/code-map/schemas/submap`, and `@abbaing/code-map/schemas/submap-request`. TypeScript declarations are included with the package.

Project maps, graphs, and submaps currently support version `1`. Documents declaring later versions are rejected until an explicit compatibility path or migration is implemented.

### Exit codes

| Code | Meaning                                 |
| ---- | --------------------------------------- |
| `0`  | Success                                 |
| `1`  | Unexpected internal error               |
| `2`  | Invalid arguments or request            |
| `3`  | Graph, submap, or seed not found        |
| `4`  | Invalid or inconsistent submap          |
| `5`  | Submap does not match the current graph |
| `6`  | Output file already exists              |

Submaps describe access intent but do not enforce filesystem permissions. External tools remain responsible for controlling writes.

## FAQ

**Does it work without a backend?**
Yes. `sourceRoots.backend` is optional. Frontend-only projects work out of the box.

**Which stacks are supported?**
Specialized analysis currently supports React frontends and .NET backends. Detection also recognizes Vue, Angular, Node.js, Go, and Python markers, but those stacks require custom templates for specialized analysis. See [Supported stacks](#supported-stacks).

**Is `.code-map/graph.json` safe to commit?**
No. It contains your full repository topology. Add it to `.gitignore`.

**Can I use it in CI?**
Yes. `code-map --scan --config <path>` writes the configured graph output and exits with code 0. In zero-config mode the default is `.code-map/graph.json`.

## License

code-map is open source under the GNU Affero General Public License v3.0 (`AGPL-3.0-only`).

Commercial licenses are available for proprietary, hosted, white-label, or AGPL-incompatible use. See [COMMERCIAL.md](COMMERCIAL.md).

Project policies and maintainer documentation are available in [ARCHITECTURE.md](ARCHITECTURE.md), [COMPONENTS.md](COMPONENTS.md), [CHANGELOG.md](CHANGELOG.md), [CONTRIBUTING.md](CONTRIBUTING.md), [RELEASING.md](RELEASING.md), and [SECURITY.md](SECURITY.md).
