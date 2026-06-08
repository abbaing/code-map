# >> c0de::map

Codebases don't break all at once. They drift.

A feature imports from another feature's internals. A repository pulls in a UI component. A domain layer references infrastructure. A controller grows business logic. Each violation is small. Together they compound into a codebase nobody wants to touch.

code-map scans your source tree and surfaces what's wrong: orphaned files, broken layer boundaries, high-coupling hotspots, undertested modules, cross-feature leaks. Before they become someone else's problem.

```bash
npx code-map --init
npx code-map --config my-app.project-map.json
```

Open `http://localhost:4179` and see the full picture: a live dependency graph with every architectural violation, quality score, and dead-code signal attached to the file that caused it.

---

## Why code-map

**For tech leads**

- Enforce layer boundaries with rules. Violations surface as findings on every scan
- See coupling and cohesion scores per module. Know which areas are accumulating debt
- Catch architectural drift in code review before it merges

**For developers**

- Know exactly where a file sits in the architecture before you touch it
- Find orphaned files, duplicated responsibilities, and missing test coverage at a glance
- Understand the blast radius of a change without running the app

---

## How it works

code-map scans your source tree statically. No build required, no instrumentation. It reads imports, classifies files by architectural role, matches frontend calls to backend endpoints, and scores each module by cohesion and coupling.

The result is a `graph.json` and a local viewer served at port 4179. Everything runs on your machine. Nothing leaves your repo.

---

## Requirements

Node.js 20 or later. No dependencies.

---

## Getting started

**1. Generate a config**

```bash
npx code-map --init
```

Detects your source roots, import aliases, and modules. Writes a `<project>.project-map.json` in the current directory. Review it and adjust `sourceRoots`, `modules.labels`, and `imports.aliases` to match your project.

**2. Open the viewer**

```bash
npx code-map --config <project>.project-map.json
```

`http://localhost:4179` is now live.

You can also run `npx code-map` without a config. In that mode code-map auto-detects the current repository, writes `graph.json`, and serves the viewer. Use `--init` when you want a committed, reviewable config. The packaged preset in `presets/starter.project-map.json` is only a starter template.

The config can live anywhere in your repository:

```bash
npx code-map --config docs/03-technical/code-map/project-map.json
CODE_MAP_CONFIG=docs/03-technical/code-map/project-map.json npx code-map --scan
```

Plugin paths in `templates.plugins` are resolved relative to the `project-map.json` file. Repository paths such as `sourceRoots.frontend` and `project.graphOutput` are resolved from the directory where you run `code-map`.

---

## CLI

```
code-map                          Scan and serve the viewer
code-map --config <path>          Use a specific project-map.json
code-map --init                   Auto-detect and write project-map.json
code-map --init --out <dir>       Write to a specific directory
code-map --scan                   Scan only, no viewer
code-map --scan --config <path>   Scan with a specific config, no viewer
code-map --templates              List available templates
code-map --help                   Show help
```

| Variable          | Default | Description              |
| ----------------- | ------- | ------------------------ |
| `CODE_MAP_CONFIG` | none    | Path to project-map.json |
| `CODE_MAP_PORT`   | `4179`  | Viewer server port       |

---

## project-map.json

The config file controls what gets scanned, how files are classified, and which rules run. `--init` generates one. You own it from there.

```json
{
  "schemaVersion": 1,
  "project": {
    "name": "My App",
    "graphOutput": "graph.json"
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
  "layers": [
    { "id": "ui-route", "label": "Routes" },
    { "id": "ui-page", "label": "Pages" },
    { "id": "ui-component-logic", "label": "Components" },
    { "id": "front-service", "label": "Services" }
  ],
  "templates": {
    "enabled": ["filesystem", "typescript", "react", "coverage", "quality"]
  },
  "rules": {
    "enabled": [],
    "suppressions": []
  }
}
```

---

## Templates

Compose capability sets in `templates.enabled`. Order matters: later templates extend earlier ones.

| Template                          | Adds                                         |
| --------------------------------- | -------------------------------------------- |
| `filesystem`                      | File discovery, ignored dirs                 |
| `typescript`                      | Import graph, alias resolution, TS rules     |
| `react`                           | Component classification, React rules        |
| `http-endpoints`                  | Frontend to backend endpoint matching       |
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

Plugin paths are relative to the `project-map.json` file.

---

## Rules

Rules run after the scan and attach findings to graph nodes.

```json
{
  "rules": {
    "enabled": [
      "technology.typescript.no-any",
      "framework.react.component-max-lines"
    ],
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

---

## FAQ

**Does it work without a backend?**
Yes. `sourceRoots.backend` is optional. Frontend-only projects work out of the box.

**Which stacks are supported?**
Auto-detection covers React, Vue, Angular frontends and .NET, Node.js, Go backends. Any project can be configured manually.

**Is graph.json safe to commit?**
No. It contains your full repository topology. Add it to `.gitignore`.

**Can I use it in CI?**
Yes. `code-map --scan --config <path>` writes `graph.json` and exits with code 0.

---

## License

code-map is open source under the GNU Affero General Public License v3.0 (`AGPL-3.0-only`).

Commercial licenses are available for proprietary, hosted, white-label, or AGPL-incompatible use. See [COMMERCIAL.md](COMMERCIAL.md).
