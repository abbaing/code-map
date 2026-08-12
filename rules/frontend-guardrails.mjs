import { getRuleMetadata, runFileRules } from '#rules/rule-runner.mjs'
import { RULES } from '#rules/frontend-guardrail-catalog.mjs'

export { RULES } from '#rules/frontend-guardrail-catalog.mjs'

export function runFrontendGuardrails(...args) {
  const [files, defaultRules, projectContext, findingSink, sourceReader, sourceDocuments] = args
  runFileRules(
    files,
    RULES,
    defaultRules,
    projectContext.projectMap.rules,
    projectContext,
    findingSink,
    undefined,
    sourceReader,
    sourceDocuments
  )
}

export function getFrontendGuardrailMetadata() {
  return getRuleMetadata(RULES)
}
