import { classifyFront } from '#core/classify.mjs'

export function runFileRules(...args) {
  const [
    files,
    rules,
    defaultRules,
    repoRules,
    projectContext,
    findingSink,
    suppliedClassifier,
    suppliedReader,
    sourceDocuments
  ] = args
  const classify = suppliedClassifier ?? classifySource
  const sourceReader = suppliedReader ?? projectContext.sourceReader
  if (!findingSink || typeof findingSink.add !== 'function') {
    throw new TypeError('Rule execution requires a finding sink.')
  }
  const effectiveRules = effectiveRuleConfig(repoRules, defaultRules)
  const enabledIds = new Set(
    effectiveRules.enabled ?? rules.filter((rule) => rule.defaultEnabled).map((rule) => rule.id)
  )
  const activeRules = rules.filter((rule) => ruleEnabled(rule, enabledIds))

  for (const file of files) {
    const repoPath = projectContext.toRepoPath(file)
    const sourceDocument = sourceDocuments?.documentOf(file)
    const content = sourceDocument?.content ?? sourceReader.readText(file)
    const syntax = sourceDocument?.syntax
    const classification = classify(repoPath, projectContext)
    const nodeId = `file:${repoPath}`

    for (const rule of activeRules) {
      rule.check({
        nodeId,
        repoPath,
        content,
        syntax,
        type: classification.type,
        layer: classification.layer,
        projectMapRules: effectiveRules,
        projectContext,
        findingSink
      })
    }
  }
}

export function getRuleMetadata(rules) {
  return Object.fromEntries(
    rules.map((rule) => [
      rule.id,
      {
        label: formatRuleLabel(rule.id),
        legacyIds: rule.legacyIds ?? [],
        ...rule.meta
      }
    ])
  )
}

export function ruleOption(projectMapRules, rule, optionName) {
  const candidates = [rule.id, ...(rule.legacyIds ?? [])]
  for (const id of candidates) {
    const value = projectMapRules?.options?.[id]?.[optionName]
    if (value !== undefined) {
      return value
    }
  }
  return undefined
}

export function findingBase(rule) {
  return { ruleId: rule.id, ...rule.meta }
}

export function lineOfIndex(content, index = 0) {
  return content.slice(0, index).split(/\r?\n/).length
}

function classifySource(repoPath, projectContext) {
  const [type, layer] = classifyFront(repoPath, projectContext)
  return { type, layer }
}

function effectiveRuleConfig(repoRules = {}, defaultRules = {}) {
  return {
    ...repoRules,
    enabled:
      Array.isArray(repoRules.enabled) && repoRules.enabled.length > 0 ? repoRules.enabled : defaultRules.enabled,
    options: {
      ...(defaultRules.options ?? {}),
      ...(repoRules.options ?? {})
    },
    suppressions: repoRules.suppressions ?? []
  }
}

function ruleEnabled(rule, enabledIds) {
  if (enabledIds.has(rule.id)) {
    return true
  }
  return (rule.legacyIds ?? []).some((id) => enabledIds.has(id))
}

function formatRuleLabel(ruleId) {
  return ruleId
    .replace(/^(technology|framework|architecture|repo)\./, '')
    .split(/[-.]/)
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(' ')
}
