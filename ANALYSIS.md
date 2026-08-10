# Static analysis precision

code-map uses bounded static heuristics rather than building or executing the target application. This matrix records which syntax forms have executable guarantees and where manual runtime links or future parser-backed extractors are required.

## Status model

- **Supported:** covered by a contract fixture and expected to produce a stable result.
- **Heuristic:** covered by a fixture, but dynamic values are normalized or inferred with reduced precision.
- **Known limitation:** covered by a fixture that records the current absence or fallback behavior.

## Executable matrix

| ID      | Area          | Status           | Guarantee or limit                                               |
| ------- | ------------- | ---------------- | ---------------------------------------------------------------- |
| TS-01   | Imports       | Supported        | Static default and named imports are detected.                   |
| TS-02   | Imports       | Supported        | Side-effect imports are detected.                                |
| TS-03   | Imports       | Supported        | Type-only imports are detected.                                  |
| TS-04   | Imports       | Supported        | Re-exports with `from` are detected.                             |
| TS-05   | Imports       | Supported        | Commented imports and import-shaped string values are ignored.   |
| TS-06   | Imports       | Supported        | Literal dynamic `import()` calls produce lazy dependency edges.  |
| TS-07   | Imports       | Known limitation | CommonJS `require()` calls are not dependency edges.             |
| TS-08   | Imports       | Known limitation | Computed dynamic import specifiers are not resolved.             |
| HTTP-01 | Frontend HTTP | Supported        | Literal `fetch()` calls and literal methods are detected.        |
| HTTP-02 | Frontend HTTP | Supported        | Bound base URLs in instance methods are detected.                |
| HTTP-03 | Frontend HTTP | Heuristic        | Template parameters are normalized to `{}`.                      |
| HTTP-04 | Frontend HTTP | Supported        | Object-style request calls are detected.                         |
| HTTP-05 | Frontend HTTP | Known limitation | Concatenated URL expressions are not resolved.                   |
| CS-01   | .NET API      | Supported        | Literal controller routes and block-bodied actions are detected. |
| CS-02   | .NET API      | Supported        | Expression-bodied controller actions are detected.               |
| CS-03   | .NET API      | Known limitation | Route constants and computed attributes are not resolved.        |

The fixtures live in `tests/analysis-precision.test.mjs`. When support changes, update the fixture and this matrix together. A known limitation becoming supported should be an explicit compatibility decision rather than an incidental regex change.

## General limits

- Runtime-only relationships, reflection, generated code, and dependency injection behavior may require `project.runtimeLinks`.
- TypeScript and JavaScript module references are parsed without executing the target application.
- Computed HTTP methods fall back to the extractor default when no literal method is available.
- Confidence metadata distinguishes confirmed and inferred graph relationships where the scanner has enough evidence.
- Serialized edges retain `confidence`, `source`, and `evidence`; the viewer exposes all three on connected relations.
