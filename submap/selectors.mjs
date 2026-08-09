import { SubmapError } from '#submap/errors.mjs'

const ACCESS_LEVELS = ['editable', 'readable', 'external', 'forbidden', 'generated']

export function normalizeRequest(request = {}) {
  validateRequestShape(request)
  const id = String(request.id ?? '').trim()
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(id)) {
    throw new SubmapError('SUBMAP_INVALID_ID', 'Submap id must use letters, numbers, dots, underscores, or hyphens.', {
      id
    })
  }

  const direction = request.traversal?.direction ?? 'both'
  if (!['incoming', 'outgoing', 'both'].includes(direction)) {
    throw new SubmapError('SUBMAP_INVALID_DIRECTION', 'Traversal direction must be incoming, outgoing, or both.', {
      direction
    })
  }

  const maxDepth = request.traversal?.maxDepth ?? 1
  if (!Number.isInteger(maxDepth) || maxDepth < 0) {
    throw new SubmapError('SUBMAP_INVALID_DEPTH', 'Traversal maxDepth must be a non-negative integer.', { maxDepth })
  }

  const defaultAccess = request.access?.default ?? 'readable'
  if (!ACCESS_LEVELS.includes(defaultAccess)) {
    throw new SubmapError('SUBMAP_INVALID_ACCESS', 'Unknown default access level.', { access: defaultAccess })
  }
  if (request.parentUid != null && !/^sha256:[a-f0-9]{64}$/.test(request.parentUid)) {
    throw new SubmapError('SUBMAP_INVALID_PARENT_UID', 'parentUid must be a SHA-256 identifier.', {
      parentUid: request.parentUid
    })
  }

  return {
    id,
    revision: normalizeRevision(request.revision),
    parentUid: request.parentUid ?? null,
    selectors: normalizeSelector(request.selectors),
    traversal: {
      direction,
      maxDepth,
      edgeTypes: strings(request.traversal?.edgeTypes),
      excludedEdgeTypes: strings(request.traversal?.excludedEdgeTypes)
    },
    exclusions: normalizeSelector(request.exclusions),
    access: {
      default: defaultAccess,
      ...Object.fromEntries(ACCESS_LEVELS.map((level) => [level, normalizeSelector(request.access?.[level])]))
    },
    metadata: isObject(request.metadata) ? request.metadata : {}
  }
}

export function resolveSeeds(graph, selectors) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const missingNodeIds = selectors.nodeIds.filter((id) => !nodeById.has(id))
  if (missingNodeIds.length) {
    throw new SubmapError(
      'SUBMAP_SEED_NOT_FOUND',
      'One or more explicit seed nodes were not found.',
      { nodeIds: missingNodeIds },
      3
    )
  }

  const ids = new Set(selectors.nodeIds)
  for (const node of graph.nodes) {
    if (selectors.paths.some((pattern) => globMatches(pattern, node.path ?? ''))) {
      ids.add(node.id)
    }
    if (matchesAttributeQuery(node, selectors)) {
      ids.add(node.id)
    }
  }

  if (!ids.size) {
    throw new SubmapError('SUBMAP_NO_SEEDS', 'The selectors did not resolve any seed nodes.', { selectors }, 3)
  }
  return ids
}

export function resolveSelectorNodeIds(nodes, selector) {
  const ids = new Set(selector.nodeIds)
  for (const node of nodes) {
    if (selector.paths.some((pattern) => globMatches(pattern, node.path ?? ''))) {
      ids.add(node.id)
    }
    if (matchesAttributeQuery(node, selector)) {
      ids.add(node.id)
    }
  }
  return ids
}

export function globMatches(pattern, value) {
  const normalizedPattern = String(pattern).replaceAll('\\', '/')
  const normalizedValue = String(value).replaceAll('\\', '/')
  const escaped = normalizedPattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/::DOUBLE_STAR::/g, '.*')
  return new RegExp(`^${escaped}$`).test(normalizedValue)
}

export function selectorIsEmpty(selector) {
  return ['nodeIds', 'paths', 'modules', 'layers', 'types'].every((key) => selector[key].length === 0)
}

export { ACCESS_LEVELS }

function normalizeSelector(selector = {}) {
  return {
    nodeIds: strings(selector?.nodeIds ?? selector?.nodes),
    paths: strings(selector?.paths),
    modules: strings(selector?.modules),
    layers: strings(selector?.layers),
    types: strings(selector?.types)
  }
}

function matchesAttributeQuery(node, selector) {
  const hasQuery = selector.modules.length || selector.layers.length || selector.types.length
  if (!hasQuery) {
    return false
  }
  return (
    (!selector.modules.length || selector.modules.includes(node.module)) &&
    (!selector.layers.length || selector.layers.includes(node.layer)) &&
    (!selector.types.length || selector.types.includes(node.type))
  )
}

function strings(values = []) {
  const list = Array.isArray(values) ? values : [values]
  return [
    ...new Set(
      list
        .filter((value) => value !== undefined && value !== null)
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  ].sort()
}

function normalizeRevision(value) {
  const revision = value ?? 1
  if (!Number.isInteger(revision) || revision < 1) {
    throw new SubmapError('SUBMAP_INVALID_REVISION', 'Submap revision must be a positive integer.', { revision })
  }
  return revision
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function validateRequestShape(request) {
  if (!isObject(request)) {
    throw new SubmapError('SUBMAP_INVALID_REQUEST', 'Submap request must be a JSON object.')
  }
  assertKnownKeys(
    request,
    ['id', 'revision', 'parentUid', 'selectors', 'traversal', 'exclusions', 'access', 'metadata'],
    'request'
  )
  validateSelectorShape(request.selectors, 'selectors')
  validateSelectorShape(request.exclusions, 'exclusions')
  if (request.traversal !== undefined) {
    if (!isObject(request.traversal)) {
      throw new SubmapError('SUBMAP_INVALID_REQUEST', 'traversal must be an object.')
    }
    assertKnownKeys(request.traversal, ['direction', 'maxDepth', 'edgeTypes', 'excludedEdgeTypes'], 'traversal')
    validateStringArray(request.traversal.edgeTypes, 'traversal.edgeTypes')
    validateStringArray(request.traversal.excludedEdgeTypes, 'traversal.excludedEdgeTypes')
  }
  if (request.access !== undefined) {
    if (!isObject(request.access)) {
      throw new SubmapError('SUBMAP_INVALID_REQUEST', 'access must be an object.')
    }
    assertKnownKeys(request.access, ['default', ...ACCESS_LEVELS], 'access')
    for (const level of ACCESS_LEVELS) {
      validateSelectorShape(request.access[level], `access.${level}`)
    }
  }
  if (request.metadata !== undefined && !isObject(request.metadata)) {
    throw new SubmapError('SUBMAP_INVALID_REQUEST', 'metadata must be an object.')
  }
}

function validateSelectorShape(selector, location) {
  if (selector === undefined) {
    return
  }
  if (!isObject(selector)) {
    throw new SubmapError('SUBMAP_INVALID_REQUEST', `${location} must be an object.`)
  }
  assertKnownKeys(selector, ['nodeIds', 'nodes', 'paths', 'modules', 'layers', 'types'], location)
  for (const key of ['nodeIds', 'nodes', 'paths', 'modules', 'layers', 'types']) {
    validateStringArray(selector[key], `${location}.${key}`)
  }
}

function validateStringArray(value, location) {
  if (value === undefined) {
    return
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new SubmapError('SUBMAP_INVALID_REQUEST', `${location} must be an array of non-empty strings.`)
  }
}

function assertKnownKeys(value, allowed, location) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key))
  if (unknown.length) {
    throw new SubmapError('SUBMAP_UNKNOWN_REQUEST_PROPERTY', `Unknown properties in ${location}.`, {
      location,
      properties: unknown.sort()
    })
  }
}
