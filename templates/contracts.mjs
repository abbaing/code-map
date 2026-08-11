function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty string.`)
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array.`)
  }
}

function assertRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`)
  }
}

function assertCapability(capability, kind, templateId) {
  if (!capability || typeof capability !== 'object') {
    throw new TypeError(`Template ${templateId} ${kind} capabilities must be objects.`)
  }
  assertNonEmptyString(capability.id, `Template ${templateId} ${kind} id`)
  assertArray(capability.requires, `${kind} ${capability.id} requirements`)
  assertArray(capability.optionalRequires ?? [], `${kind} ${capability.id} optional requirements`)
  const names = [...capability.requires, ...(capability.optionalRequires ?? [])]
  if (names.some((name) => typeof name !== 'string' || name.length === 0) || new Set(names).size !== names.length) {
    throw new TypeError(`${kind} ${capability.id} requirements must be unique non-empty names.`)
  }
  if (typeof capability.run !== 'function') {
    throw new TypeError(`${kind} ${capability.id} must implement run(input).`)
  }
  if (capability.assign !== undefined) {
    assertNonEmptyString(capability.assign, `${kind} ${capability.id} assignment`)
  }
}

function assertFileKind(kind, templateId) {
  if (!kind || typeof kind !== 'object') {
    throw new TypeError(`Template ${templateId} file kind capabilities must be objects.`)
  }
  assertNonEmptyString(kind.id, `Template ${templateId} file kind id`)
  assertNonEmptyString(kind.rootKey, `File kind ${kind.id} rootKey`)
  assertArray(kind.extensions ?? [], `File kind ${kind.id} extensions`)
  if ((kind.extensions ?? []).some((extension) => typeof extension !== 'string')) {
    throw new TypeError(`File kind ${kind.id} extensions must be strings.`)
  }
  if (kind.test !== undefined && typeof kind.test !== 'function') {
    throw new TypeError(`File kind ${kind.id} test must be a function.`)
  }
  for (const flag of ['includeTests', 'testsOnly']) {
    if (kind[flag] !== undefined && typeof kind[flag] !== 'boolean') {
      throw new TypeError(`File kind ${kind.id} ${flag} must be a boolean.`)
    }
  }
}

function assertParserCapability(parser, templateId) {
  if (!parser || typeof parser !== 'object') {
    throw new TypeError(`Template ${templateId} parser capabilities must be objects.`)
  }
  assertNonEmptyString(parser.id, `Template ${templateId} parser id`)
  assertArray(parser.extensions, `Parser ${parser.id} extensions`)
  if (parser.extensions.length === 0 || parser.extensions.some((extension) => typeof extension !== 'string')) {
    throw new TypeError(`Parser ${parser.id} extensions must be non-empty strings.`)
  }
  if (typeof parser.parse !== 'function') {
    throw new TypeError(`Parser ${parser.id} must implement parse(content, file).`)
  }
}

function assertUniqueIds(items, label, templateId) {
  const ids = new Set()
  for (const item of items) {
    if (ids.has(item.id)) {
      throw new TypeError(`Template ${templateId} has duplicate ${label} id: ${item.id}.`)
    }
    ids.add(item.id)
  }
}

export function assertTemplate(template) {
  if (!template || typeof template !== 'object') {
    throw new TypeError('Template must be an object.')
  }
  assertNonEmptyString(template.id, 'Template id')
  assertNonEmptyString(template.description, `Template ${template.id} description`)
  if (template.stage !== undefined) {
    assertNonEmptyString(template.stage, `Template ${template.id} stage`)
  }
  assertArray(template.requiresTemplates ?? [], `Template ${template.id} dependencies`)
  const dependencies = template.requiresTemplates ?? []
  if (
    dependencies.some((dependency) => typeof dependency !== 'string' || dependency.length === 0) ||
    new Set(dependencies).size !== dependencies.length
  ) {
    throw new TypeError(`Template ${template.id} dependencies must be unique non-empty names.`)
  }
  if (dependencies.includes(template.id)) {
    throw new TypeError(`Template ${template.id} cannot depend on itself.`)
  }
  assertArray(template.layers ?? [], `Template ${template.id} layers`)
  assertArray(template.architecture ?? [], `Template ${template.id} architecture`)
  assertRecord(template.types ?? {}, `Template ${template.id} types`)
  assertRecord(template.rules ?? {}, `Template ${template.id} rules`)
  assertRecord(template.ruleMetadata ?? {}, `Template ${template.id} rule metadata`)
  assertRecord(template.capabilities ?? {}, `Template ${template.id} capabilities`)
  const capabilities = template.capabilities ?? {}
  const fileKinds = capabilities.fileKinds ?? []
  const parsers = capabilities.parsers ?? []
  const scanners = capabilities.scanners ?? []
  const enrichers = capabilities.enrichers ?? []
  assertArray(fileKinds, `Template ${template.id} file kinds`)
  assertArray(parsers, `Template ${template.id} parsers`)
  assertArray(scanners, `Template ${template.id} scanners`)
  assertArray(enrichers, `Template ${template.id} enrichers`)
  fileKinds.forEach((kind) => assertFileKind(kind, template.id))
  parsers.forEach((parser) => assertParserCapability(parser, template.id))
  scanners.forEach((scanner) => assertCapability(scanner, 'scanner', template.id))
  enrichers.forEach((enricher) => assertCapability(enricher, 'enricher', template.id))
  assertUniqueIds(fileKinds, 'file kind', template.id)
  assertUniqueIds(parsers, 'parser', template.id)
  assertUniqueIds(scanners, 'scanner', template.id)
  assertUniqueIds(enrichers, 'enricher', template.id)
  return template
}

export function assertCapabilityRegistry(registry) {
  const capabilities = registry?.capabilities
  assertRecord(capabilities, 'Template registry capabilities')
  assertUniqueIds(capabilities.fileKinds, 'file kind', 'effective registry')
  assertUniqueIds(capabilities.parsers, 'parser', 'effective registry')
  assertUniqueIds(capabilities.scanners, 'scanner', 'effective registry')
  assertUniqueIds(capabilities.enrichers, 'enricher', 'effective registry')
  return registry
}

export function capabilityInput(capability, context) {
  const missing = capability.requires.filter((name) => !Object.hasOwn(context, name))
  if (missing.length > 0) {
    throw new Error(`Capability ${capability.id} is missing required input: ${missing.join(', ')}.`)
  }
  const names = [
    ...capability.requires,
    ...(capability.optionalRequires ?? []).filter((name) => Object.hasOwn(context, name))
  ]
  return Object.freeze(Object.fromEntries(names.map((name) => [name, context[name]])))
}

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  for (const nested of Object.values(value)) {
    deepFreeze(nested)
  }
  return Object.freeze(value)
}
