import { getFrontendGuardrailMetadata } from '../rules/frontend-guardrails.mjs'
import { getArchitectureGuardrailMetadata } from '../rules/architecture-guardrails.mjs'

export function pickRuleMetadata(ids, extraMetadata = {}) {
  const all = {
    ...getFrontendGuardrailMetadata(),
    ...getArchitectureGuardrailMetadata(),
    ...extraMetadata
  }
  return Object.fromEntries(ids.map(id => [id, all[id]]).filter(([, value]) => value))
}
