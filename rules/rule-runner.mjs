import { importsOf, readText, toRepoPath } from '../scan-utils.mjs'
import { classifyFront } from '../classify.mjs'

export function runFileRules(files, rules, defaultRules, repoRules, classify = classifySource) {
  const effectiveRules = effectiveRuleConfig(repoRules, defaultRules)
  const enabledIds = new Set(effectiveRules.enabled ?? rules.filter(rule => rule.defaultEnabled).map(rule => rule.id))
  const activeRules = rules.filter(rule => ruleEnabled(rule, enabledIds))

  for (const file of files) {
    const repoPath = toRepoPath(file)
    const content = readText(file)
    const classification = classify(repoPath)
    const nodeId = `file:${repoPath}`

    for (const rule of activeRules) {
      rule.check({
        nodeId,
        repoPath,
        content,
        type: classification.type,
        layer: classification.layer,
        projectMapRules: effectiveRules
      })
    }
  }
}

export function getRuleMetadata(rules) {
  return Object.fromEntries(rules.map(rule => [
    rule.id,
    {
      label: formatRuleLabel(rule.id),
      legacyIds: rule.legacyIds ?? [],
      ...rule.meta
    }
  ]))
}

export function ruleOption(projectMapRules, rule, optionName) {
  const candidates = [rule.id, ...(rule.legacyIds ?? [])]
  for (const id of candidates) {
    const value = projectMapRules?.options?.[id]?.[optionName]
    if (value !== undefined) return value
  }
  return undefined
}

export function findingBase(rule) {
  return { ruleId: rule.id, ...rule.meta }
}

export function lineOfIndex(content, index = 0) {
  return content.slice(0, index).split(/\r?\n/).length
}

export { importsOf }

function classifySource(repoPath) {
  const [type, layer] = classifyFront(repoPath)
  return { type, layer }
}

function effectiveRuleConfig(repoRules = {}, defaultRules = {}) {
  return {
    ...repoRules,
    enabled: Array.isArray(repoRules.enabled) && repoRules.enabled.length > 0
      ? repoRules.enabled
      : defaultRules.enabled,
    options: {
      ...(defaultRules.options ?? {}),
      ...(repoRules.options ?? {})
    },
    suppressions: repoRules.suppressions ?? []
  }
}

function ruleEnabled(rule, enabledIds) {
  if (enabledIds.has(rule.id)) return true
  return (rule.legacyIds ?? []).some(id => enabledIds.has(id))
}

function formatRuleLabel(ruleId) {
  return ruleId
    .replace(/^(technology|framework|architecture|repo)\./, '')
    .split(/[-.]/)
    .map(part => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(' ')
}
