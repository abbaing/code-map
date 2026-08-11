import { getFrontendGuardrailMetadata } from '#rules/frontend-guardrails.mjs'
import { getTypeScriptArchitectureGuardrailMetadata } from '#rules/typescript-architecture-guardrails.mjs'
import { getCSharpArchitectureGuardrailMetadata } from '#rules/csharp-architecture-guardrails.mjs'

export function pickRuleMetadata(ids, extraMetadata = {}) {
  const all = {
    ...getFrontendGuardrailMetadata(),
    ...getTypeScriptArchitectureGuardrailMetadata(),
    ...getCSharpArchitectureGuardrailMetadata(),
    ...extraMetadata
  }
  return Object.fromEntries(ids.map((id) => [id, all[id]]).filter(([, value]) => value))
}
