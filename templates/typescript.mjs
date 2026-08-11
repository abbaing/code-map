import { isTestFile, tsExtensions, typescriptParser } from '#parsers/typescript.mjs'
import { runFrontendGuardrails } from '#rules/frontend-guardrails.mjs'
import { runTypeScriptArchitectureGuardrails } from '#rules/typescript-architecture-guardrails.mjs'
import { pickRuleMetadata } from '#templates/rule-metadata.mjs'

export const typescriptTemplate = {
  id: 'typescript',
  stage: 'technology',
  description: 'TypeScript and JavaScript file discovery, import graph, aliases, tests, and type-safety rules.',
  rules: {
    enabled: ['technology.typescript.relative-imports', 'technology.typescript.no-any']
  },
  ruleMetadata: pickRuleMetadata(['technology.typescript.relative-imports', 'technology.typescript.no-any']),
  capabilities: {
    parsers: [typescriptParser],
    fileKinds: [
      {
        id: 'frontend-source',
        rootKey: 'frontend',
        extensions: tsExtensions,
        test: isTestFile,
        includeTests: false
      },
      {
        id: 'frontend-test',
        rootKey: 'frontend',
        extensions: tsExtensions,
        test: isTestFile,
        includeTests: true,
        testsOnly: true
      }
    ],
    enrichers: [
      {
        id: 'typescript.guardrails',
        requires: ['files', 'registry', 'projectContext', 'findingSink', 'sourceReader', 'sourceDocuments'],
        run: (context) => {
          const files = context.files.of('frontend-source')
          runFrontendGuardrails(
            files,
            context.registry.rules,
            context.projectContext,
            context.findingSink,
            context.sourceReader,
            context.sourceDocuments
          )
          runTypeScriptArchitectureGuardrails(
            files,
            context.registry.rules,
            context.projectContext,
            context.findingSink,
            context.sourceReader,
            context.sourceDocuments
          )
        }
      }
    ]
  }
}
