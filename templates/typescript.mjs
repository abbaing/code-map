import { isTestFile, tsExtensions } from '#core/source-analysis.mjs'
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
    ]
  }
}
