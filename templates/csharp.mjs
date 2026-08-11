import { csharpParser, isCSharpTestFile } from '#parsers/csharp.mjs'
import { runCSharpArchitectureGuardrails } from '#rules/csharp-architecture-guardrails.mjs'

export const csharpTemplate = {
  id: 'csharp',
  stage: 'technology',
  description: 'C# source discovery and parser services.',
  capabilities: {
    parsers: [csharpParser],
    fileKinds: [
      {
        id: 'backend-source',
        rootKey: 'backend',
        extensions: ['.cs'],
        test: isCSharpTestFile,
        includeTests: false
      }
    ],
    enrichers: [
      {
        id: 'csharp.guardrails',
        requires: ['files', 'registry', 'projectContext', 'findingSink', 'sourceReader', 'sourceDocuments'],
        run: (context) =>
          runCSharpArchitectureGuardrails(
            context.files.of('backend-source'),
            context.registry.rules,
            context.projectContext,
            context.findingSink,
            context.sourceReader,
            context.sourceDocuments
          )
      }
    ]
  }
}
