import { assertTemplate, deepFreeze } from '#templates/contracts.mjs'

const templates = new Map()

export function registerTemplate(template) {
  const normalized = normalizeTemplate(template)
  assertTemplate(normalized)
  if (templates.has(normalized.id)) {
    throw new TypeError(`Duplicate template id: ${normalized.id}.`)
  }
  templates.set(normalized.id, deepFreeze(normalized))
}

export function getTemplate(id) {
  return templates.get(id)
}

export function listTemplates() {
  return [...templates.values()].map((template) => ({
    id: template.id,
    description: template.description,
    stage: template.stage ?? 'custom'
  }))
}

export function normalizeTemplate(template) {
  return {
    ...template,
    requiresTemplates: template.requiresTemplates ?? [],
    layers: template.layers ?? [],
    types: normalizeTypes(template.types),
    rules: normalizeRules(template.rules),
    capabilities: normalizeCapabilities(template.capabilities),
    ruleMetadata: template.ruleMetadata ?? {},
    architecture: template.architecture ?? []
  }
}

function normalizeTypes(types = {}) {
  return { labels: types.labels ?? {}, colors: types.colors ?? {} }
}

function normalizeRules(rules = {}) {
  return { enabled: rules.enabled ?? [], options: rules.options ?? {} }
}

function normalizeCapabilities(capabilities = {}) {
  return {
    fileKinds: capabilities.fileKinds ?? [],
    parsers: capabilities.parsers ?? [],
    scanners: capabilities.scanners ?? [],
    enrichers: capabilities.enrichers ?? []
  }
}

export function templateEntries() {
  return templates
}
