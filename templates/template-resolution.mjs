const defaultTemplateIds = [
  'base',
  'filesystem',
  'typescript',
  'react',
  'architecture.feature-sliced',
  'architecture.mvvm',
  'http-endpoints',
  'csharp',
  'dotnet-api',
  'architecture.mvc',
  'architecture.clean-architecture',
  'architecture.cqrs',
  'entity-framework',
  'coverage',
  'quality'
]

export function resolveTemplateIds(projectMap) {
  const configured = projectMap.templates?.enabled
  return Array.isArray(configured) && configured.length > 0
    ? ['base', ...configured.filter((id) => id !== 'base')]
    : defaultTemplateIds
}

export function expandTemplateDependencies(templateIds, templates) {
  const ordered = []
  const resolved = new Set()
  const resolving = []
  const visit = (id) => visitTemplate(id, { templates, ordered, resolved, resolving, visit })
  for (const id of templateIds) {
    visit(id)
  }
  return ordered
}

function visitTemplate(id, state) {
  if (state.resolved.has(id)) {
    return
  }
  const cycleIndex = state.resolving.indexOf(id)
  if (cycleIndex >= 0) {
    throw new Error(`Template dependency cycle: ${[...state.resolving.slice(cycleIndex), id].join(' -> ')}`)
  }
  const template = state.templates.get(id)
  if (!template) {
    const owner = state.resolving.at(-1)
    throw new Error(`Unknown code map template: ${id}${owner ? ` required by ${owner}` : ''}`)
  }
  state.resolving.push(id)
  for (const dependency of template.requiresTemplates) {
    state.visit(dependency)
  }
  state.resolving.pop()
  state.resolved.add(id)
  state.ordered.push(id)
}
