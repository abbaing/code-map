import { getRuleMetadata, runFileRules } from '#rules/rule-runner.mjs'
import { TYPESCRIPT_ARCHITECTURE_RULES } from '#rules/typescript-architecture-catalog.mjs'

export { TYPESCRIPT_ARCHITECTURE_RULES } from '#rules/typescript-architecture-catalog.mjs'

export function runTypeScriptArchitectureGuardrails(...args) {
  const [files, defaultRules, projectContext, findingSink, sourceReader, sourceDocuments] = args
  runFileRules(
    files,
    TYPESCRIPT_ARCHITECTURE_RULES,
    defaultRules,
    projectContext.projectMap.rules,
    projectContext,
    findingSink,
    undefined,
    sourceReader,
    sourceDocuments
  )
}

export function getTypeScriptArchitectureGuardrailMetadata() {
  return getRuleMetadata(TYPESCRIPT_ARCHITECTURE_RULES)
}
