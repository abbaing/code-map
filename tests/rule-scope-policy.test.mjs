import assert from 'node:assert/strict'
import { isPathInRuleScope } from '#rules/typescript-architecture-policy.mjs'

const rule = {
  id: 'technology.typescript.component-size',
  legacyIds: ['frontend.component-size']
}
const componentPath = 'viewer/features/accounts/components/account-card.tsx'

assert.equal(isPathInRuleScope(componentPath, rule), true, 'rules without path options must apply everywhere')
assert.equal(
  isPathInRuleScope(componentPath, rule, {
    options: { [rule.id]: { includePatterns: ['/features/[^/]+/components/'] } }
  }),
  true,
  'matching include patterns must retain the rule'
)
assert.equal(
  isPathInRuleScope(componentPath, rule, {
    options: { [rule.id]: { includePatterns: ['/pages/'] } }
  }),
  false,
  'non-matching include patterns must omit the rule'
)
assert.equal(
  isPathInRuleScope(componentPath, rule, {
    options: { [rule.id]: { includePatterns: [] } }
  }),
  true,
  'an empty include list must not restrict the rule'
)
assert.equal(
  isPathInRuleScope(componentPath, rule, {
    options: {
      [rule.id]: {
        includePatterns: ['/features/'],
        excludePatterns: ['/accounts/']
      }
    }
  }),
  false,
  'matching exclusions must take precedence over inclusions'
)
assert.equal(
  isPathInRuleScope(componentPath, rule, {
    options: { [rule.legacyIds[0]]: { excludePatterns: ['/accounts/'] } }
  }),
  false,
  'legacy rule options must retain their path scope'
)

console.log('rule scope policy tests passed')
