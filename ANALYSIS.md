# Static analysis precision

code-map uses parser-backed static analysis without building or executing the target application. This matrix records which syntax forms have executable guarantees and where manual runtime links or semantic analysis are still required.

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
| TS-07   | Imports       | Supported        | Literal CommonJS `require()` calls produce dependency edges.     |
| TS-08   | Imports       | Supported        | Literal concatenations in dynamic imports are resolved.          |
| TS-09   | Imports       | Supported        | Top-level string constants in dynamic imports are resolved.      |
| TS-10   | Imports       | Known limitation | Runtime-dependent dynamic import specifiers are not resolved.    |
| HTTP-01 | Frontend HTTP | Supported        | Literal `fetch()` calls and literal methods are detected.        |
| HTTP-02 | Frontend HTTP | Supported        | Bound base URLs in instance methods are detected.                |
| HTTP-03 | Frontend HTTP | Heuristic        | Template parameters are normalized to `{}`.                      |
| HTTP-04 | Frontend HTTP | Supported        | Object-style request calls are detected.                         |
| HTTP-05 | Frontend HTTP | Heuristic        | Concatenated URLs resolve dynamic segments to `{}`.              |
| HTTP-06 | Frontend HTTP | Supported        | Calls represented only in comments or strings are ignored.       |
| HTTP-07 | Frontend HTTP | Supported        | Multiline generic calls and object arguments are parsed.         |
| CS-01   | .NET API      | Supported        | Literal controller routes and block-bodied actions are detected. |
| CS-02   | .NET API      | Supported        | Expression-bodied controller actions are detected.               |
| CS-03   | .NET API      | Supported        | Literal and concatenated route string constants resolve.         |
| CS-04   | .NET API      | Supported        | Commented controller syntax is ignored.                          |
| CS-05   | .NET API      | Supported        | Controller syntax inside string values is ignored.               |
| CS-06   | .NET API      | Supported        | Literal concatenations in route attributes are resolved.         |
| CS-07   | .NET API      | Supported        | Same-file route constants can reference other constants.         |

The fixtures live in `tests/analysis-precision.test.mjs`. When support changes, update the fixture and this matrix together. A known limitation becoming supported should be an explicit compatibility decision rather than an incidental regex change.

## General limits

- Runtime-only relationships, reflection, generated code, and dependency injection behavior may require `project.runtimeLinks`.
- TypeScript and JavaScript imports, calls, declarations, and type nodes use the TypeScript compiler AST.
- C# declarations, attributes, methods, properties, calls, and object creation use the Tree-sitter C# grammar.
- Computed HTTP methods fall back to the extractor default when no literal method is available.
- Concatenated frontend URLs preserve literal and bound base segments while replacing other expressions with `{}`.
- C# route constants resolve literal and concatenated `const string` fields across the scanned backend. References between constants resolve within one file; constant expressions spanning files, runtime-computed expressions, and non-string values remain unsupported.
- Confidence metadata distinguishes confirmed and inferred graph relationships where the scanner has enough evidence.
- Serialized edges retain `confidence`, `source`, and `evidence`; the viewer exposes all three on connected relations.
