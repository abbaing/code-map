import path from 'node:path'

export function validateProjectMap(projectMap, configPath, { repoRoot = '.', toRepoPath = relativePath } = {}) {
  const errors = []
  if (!isRecord(projectMap)) {
    errors.push('Project map must be a JSON object.')
  } else {
    validateDocument(errors, projectMap)
  }
  if (errors.length > 0) {
    const location = toRepoPath(repoRoot, configPath)
    throw new Error(`Invalid project map ${location}:\n${errors.map((error) => `- ${error}`).join('\n')}`)
  }
}

function validateDocument(errors, map) {
  validateSchema(errors, map)
  validateProject(errors, map.project)
  validateSourceRoots(errors, map.sourceRoots)
  validateTemplates(errors, map.templates)
  validateStringArray(errors, map.ignoredDirs, 'ignoredDirs', { optional: true, allowEmptyItems: true })
  validateImports(errors, map.imports)
  validateLayers(errors, map.layers)
  validateRules(errors, map.rules)
  for (const key of ['modules', 'types', 'frontend', 'backend']) {
    if (map[key] !== undefined && !isRecord(map[key])) {
      errors.push(`${key} must be an object.`)
    }
  }
}

function validateSchema(errors, map) {
  if (!Number.isInteger(map.schemaVersion)) {
    errors.push('schemaVersion must be an integer.')
  } else if (map.schemaVersion !== 1) {
    errors.push('Only project map schema version 1 is supported.')
  }
  if (map.$schema !== undefined && typeof map.$schema !== 'string') {
    errors.push('$schema must be a string.')
  }
}

function validateProject(errors, project) {
  if (!isRecord(project)) {
    errors.push('project must be an object.')
  }
  if (!project?.name) {
    errors.push('project.name is required.')
  } else if (!isNonEmptyString(project.name)) {
    errors.push('project.name must be a non-empty string.')
  }
  for (const key of ['graphOutput', 'runtimeLinks', 'submapsDirectory']) {
    validateOptionalString(errors, project?.[key], `project.${key}`)
  }
}

function validateSourceRoots(errors, roots) {
  if (!isRecord(roots)) {
    errors.push('sourceRoots must be an object.')
  }
  if (!roots?.frontend) {
    errors.push('sourceRoots.frontend is required.')
  } else if (!isNonEmptyString(roots.frontend)) {
    errors.push('sourceRoots.frontend must be a non-empty string.')
  }
  validateOptionalString(errors, roots?.backend, 'sourceRoots.backend')
  if (isRecord(roots)) {
    validateKnownKeys(errors, roots, ['frontend', 'backend'], 'sourceRoots')
  }
}

function validateTemplates(errors, templates) {
  if (templates === undefined) {
    return
  }
  if (!isRecord(templates)) {
    return errors.push('templates must be an object.')
  }
  validateStringArray(errors, templates.enabled, 'templates.enabled', { optional: true })
  validateStringArray(errors, templates.plugins, 'templates.plugins', { optional: true })
}

function validateImports(errors, imports) {
  if (imports === undefined) {
    return
  }
  if (!isRecord(imports)) {
    return errors.push('imports must be an object.')
  }
  if (imports.aliases !== undefined && !Array.isArray(imports.aliases)) {
    return errors.push('imports.aliases must be an array.')
  }
  for (const [index, alias] of (imports.aliases ?? []).entries()) {
    validateAlias(errors, alias, index)
  }
}

function validateAlias(errors, alias, index) {
  const location = `imports.aliases[${index}]`
  if (!isRecord(alias)) {
    return errors.push(`${location} must be an object.`)
  }
  validateRequiredString(errors, alias.prefix, `${location}.prefix`)
  validateRequiredString(errors, alias.path, `${location}.path`)
  validateKnownKeys(errors, alias, ['prefix', 'path'], location)
}

function validateLayers(errors, layers) {
  if (layers === undefined) {
    return
  }
  if (!Array.isArray(layers) || layers.length === 0) {
    return errors.push('layers must contain at least one layer when provided.')
  }
  for (const [index, layer] of layers.entries()) {
    const location = `layers[${index}]`
    if (!isRecord(layer)) {
      errors.push(`${location} must be an object.`)
    } else {
      validateRequiredString(errors, layer.id, `${location}.id`)
      validateRequiredString(errors, layer.label, `${location}.label`)
    }
  }
}

function validateRules(errors, rules) {
  if (rules === undefined) {
    return
  }
  if (!isRecord(rules)) {
    return errors.push('rules must be an object.')
  }
  validateStringArray(errors, rules.enabled, 'rules.enabled', { optional: true, allowEmptyItems: true })
  if (rules.options !== undefined && !isRecord(rules.options)) {
    errors.push('rules.options must be an object.')
  }
  if (rules.suppressions !== undefined && !Array.isArray(rules.suppressions)) {
    return errors.push('rules.suppressions must be an array.')
  }
  for (const [index, suppression] of (rules.suppressions ?? []).entries()) {
    validateSuppression(errors, suppression, index)
  }
}

function validateSuppression(errors, suppression, index) {
  const location = `rules.suppressions[${index}]`
  if (!isRecord(suppression)) {
    return errors.push(`${location} must be an object.`)
  }
  validateRequiredString(errors, suppression.reason, `${location}.reason`)
  for (const key of ['ruleId', 'pathPattern', 'expiresOn']) {
    if (suppression[key] !== undefined && typeof suppression[key] !== 'string') {
      errors.push(`${location}.${key} must be a string.`)
    }
  }
}

function validateStringArray(errors, value, location, { optional = false, allowEmptyItems = false } = {}) {
  if (optional && value === undefined) {
    return
  }
  if (!Array.isArray(value)) {
    return errors.push(`${location} must be an array.`)
  }
  if (value.some((item) => typeof item !== 'string' || (!allowEmptyItems && !item.trim()))) {
    errors.push(`${location} must contain ${allowEmptyItems ? 'only strings' : 'only non-empty strings'}.`)
  }
}

function validateRequiredString(errors, value, location) {
  if (!isNonEmptyString(value)) {
    errors.push(`${location} must be a non-empty string.`)
  }
}

function validateOptionalString(errors, value, location) {
  if (value !== undefined) {
    validateRequiredString(errors, value, location)
  }
}

function validateKnownKeys(errors, value, allowed, location) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key))
  if (unknown.length > 0) {
    errors.push(`${location} contains unknown properties: ${unknown.sort().join(', ')}.`)
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}
function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function relativePath(repoRoot, filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, '/')
}
