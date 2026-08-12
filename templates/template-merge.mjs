export function mergeRegistry(registry, template) {
  return {
    id: 'effective',
    description: 'Effective registry composed from ordered templates.',
    templates: [...(registry.templates ?? []), template.id],
    layers: mergeById(registry.layers, template.layers),
    types: {
      labels: { ...registry.types.labels, ...template.types.labels },
      colors: { ...registry.types.colors, ...template.types.colors }
    },
    rules: {
      enabled: [...new Set([...registry.rules.enabled, ...template.rules.enabled].filter(Boolean))],
      options: deepMerge(registry.rules.options, template.rules.options)
    },
    capabilities: {
      fileKinds: mergeById(registry.capabilities.fileKinds, template.capabilities.fileKinds),
      parsers: [...registry.capabilities.parsers, ...template.capabilities.parsers],
      scanners: [...registry.capabilities.scanners, ...template.capabilities.scanners],
      enrichers: [...registry.capabilities.enrichers, ...template.capabilities.enrichers]
    },
    ruleMetadata: { ...registry.ruleMetadata, ...template.ruleMetadata },
    architecture: mergeById(registry.architecture, template.architecture)
  }
}

function mergeById(left = [], right = []) {
  const byId = new Map(left.map((item) => [item.id, item]))
  for (const item of right) {
    byId.set(item.id, { ...(byId.get(item.id) ?? {}), ...item })
  }
  return [...byId.values()]
}

function deepMerge(left = {}, right = {}) {
  const result = { ...left }
  for (const [key, value] of Object.entries(right)) {
    result[key] = isPlainObject(value) && isPlainObject(result[key]) ? deepMerge(result[key], value) : value
  }
  return result
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}
