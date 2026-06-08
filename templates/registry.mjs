import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { templateCatalog } from './catalog.mjs'

const baseTemplate = {
  id: 'base',
  stage: 'core',
  description: 'Core graph orchestration and local viewer metadata.',
  layers: [],
  types: { labels: {}, colors: {} },
  rules: { enabled: [], options: {} },
  capabilities: {
    fileKinds: [],
    scanners: [],
    enrichers: []
  },
  architecture: []
}

const templates = new Map()

export function registerTemplate(template) {
  if (!template?.id) throw new Error('Template id is required.')
  templates.set(template.id, normalizeTemplate(template))
}

export function getTemplate(id) {
  return templates.get(id)
}

export function listTemplates() {
  return [...templates.values()].map(template => ({
    id: template.id,
    description: template.description,
    stage: template.stage ?? 'custom'
  }))
}

export function resolveTemplateIds(projectMap) {
  const configured = projectMap.templates?.enabled
  if (Array.isArray(configured) && configured.length > 0) return ['base', ...configured.filter(id => id !== 'base')]
  return [
    'base',
    'filesystem',
    'typescript',
    'react',
    'architecture.feature-sliced',
    'architecture.mvvm',
    'http-endpoints',
    'dotnet-api',
    'architecture.mvc',
    'architecture.clean-architecture',
    'architecture.cqrs',
    'entity-framework',
    'coverage',
    'quality'
  ]
}

export async function loadTemplatePlugins(projectMap, configPath) {
  const plugins = projectMap.templates?.plugins
  if (!Array.isArray(plugins) || plugins.length === 0) return
  const configDir = path.dirname(path.resolve(configPath))
  for (const pluginPath of plugins) {
    const resolved = path.isAbsolute(pluginPath) ? pluginPath : path.resolve(configDir, pluginPath)
    const mod = await import(pathToFileURL(resolved).href)
    for (const exported of Object.values(mod)) {
      if (exported?.id) registerTemplate(exported)
    }
  }
}

export function buildTemplateRegistry(projectMap) {
  const templateIds = resolveTemplateIds(projectMap)
  const selected = templateIds.map(id => {
    const template = templates.get(id)
    if (!template) throw new Error(`Unknown code map template: ${id}`)
    return template
  })

  return selected.reduce((registry, template) => mergeRegistry(registry, template), normalizeTemplate(baseTemplate))
}

function normalizeTemplate(template) {
  return {
    ...template,
    layers: template.layers ?? [],
    types: {
      labels: template.types?.labels ?? {},
      colors: template.types?.colors ?? {}
    },
    rules: {
      enabled: template.rules?.enabled ?? [],
      options: template.rules?.options ?? {}
    },
    capabilities: {
      fileKinds: template.capabilities?.fileKinds ?? [],
      scanners: template.capabilities?.scanners ?? [],
      enrichers: template.capabilities?.enrichers ?? []
    },
    ruleMetadata: template.ruleMetadata ?? {},
    architecture: template.architecture ?? []
  }
}

function mergeRegistry(registry, template) {
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
      enabled: unique([...registry.rules.enabled, ...template.rules.enabled]),
      options: deepMerge(registry.rules.options, template.rules.options)
    },
    capabilities: {
      fileKinds: mergeFileKinds(registry.capabilities.fileKinds, template.capabilities.fileKinds),
      scanners: [...registry.capabilities.scanners, ...template.capabilities.scanners],
      enrichers: [...registry.capabilities.enrichers, ...template.capabilities.enrichers]
    },
    ruleMetadata: { ...registry.ruleMetadata, ...template.ruleMetadata },
    architecture: mergeById(registry.architecture, template.architecture)
  }
}

function mergeById(left = [], right = []) {
  const byId = new Map(left.map(item => [item.id, item]))
  for (const item of right) byId.set(item.id, { ...(byId.get(item.id) ?? {}), ...item })
  return [...byId.values()]
}

function mergeFileKinds(left = [], right = []) {
  return mergeById(left, right)
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function deepMerge(left = {}, right = {}) {
  const result = { ...left }
  for (const [key, value] of Object.entries(right)) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key], value)
    } else {
      result[key] = value
    }
  }
  return result
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

registerTemplate(baseTemplate)
for (const template of templateCatalog) registerTemplate(template)
