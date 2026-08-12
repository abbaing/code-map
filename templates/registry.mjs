import { templateCatalog } from '#templates/catalog.mjs'
import { assertCapabilityRegistry, deepFreeze } from '#templates/contracts.mjs'
import {
  getTemplate,
  listTemplates,
  normalizeTemplate,
  registerTemplate,
  templateEntries
} from '#templates/template-store.mjs'
import { expandTemplateDependencies, resolveTemplateIds } from '#templates/template-resolution.mjs'
import { mergeRegistry } from '#templates/template-merge.mjs'
import { loadTemplatePlugins as loadPlugins } from '#templates/template-plugins.mjs'

const baseTemplate = {
  id: 'base',
  stage: 'core',
  description: 'Core graph orchestration and local viewer metadata.',
  layers: [],
  types: { labels: {}, colors: {} },
  rules: { enabled: [], options: {} },
  capabilities: { fileKinds: [], parsers: [], scanners: [], enrichers: [] },
  architecture: []
}

export { registerTemplate, getTemplate, listTemplates, resolveTemplateIds }

export function loadTemplatePlugins(projectMap, configPath, options) {
  return loadPlugins(projectMap, configPath, registerTemplate, options)
}

export function buildTemplateRegistry(projectMap) {
  const templates = templateEntries()
  const ids = expandTemplateDependencies(resolveTemplateIds(projectMap), templates)
  const selected = ids.map((id) => {
    const template = templates.get(id)
    if (!template) {
      throw new Error(`Unknown code map template: ${id}`)
    }
    return template
  })
  const registry = selected.reduce(mergeRegistry, normalizeTemplate(baseTemplate))
  return deepFreeze(assertCapabilityRegistry(registry))
}

registerTemplate(baseTemplate)
for (const template of templateCatalog) {
  registerTemplate(template)
}
