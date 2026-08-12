import { SubmapError } from '#submap/errors.mjs'

const selectorKeys = ['nodeIds', 'nodes', 'paths', 'modules', 'layers', 'types']

export function validateRequestShape(request, accessLevels) {
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
  validateTraversal(request.traversal)
  validateAccess(request.access, accessLevels)
  if (request.metadata !== undefined && !isObject(request.metadata)) {
    throw new SubmapError('SUBMAP_INVALID_REQUEST', 'metadata must be an object.')
  }
}

function validateTraversal(traversal) {
  if (traversal === undefined) {
    return
  }
  if (!isObject(traversal)) {
    throw new SubmapError('SUBMAP_INVALID_REQUEST', 'traversal must be an object.')
  }
  assertKnownKeys(traversal, ['direction', 'maxDepth', 'edgeTypes', 'excludedEdgeTypes'], 'traversal')
  validateStringArray(traversal.edgeTypes, 'traversal.edgeTypes')
  validateStringArray(traversal.excludedEdgeTypes, 'traversal.excludedEdgeTypes')
}

function validateAccess(access, accessLevels) {
  if (access === undefined) {
    return
  }
  if (!isObject(access)) {
    throw new SubmapError('SUBMAP_INVALID_REQUEST', 'access must be an object.')
  }
  assertKnownKeys(access, ['default', ...accessLevels], 'access')
  for (const level of accessLevels) {
    validateSelectorShape(access[level], `access.${level}`)
  }
}

function validateSelectorShape(selector, location) {
  if (selector === undefined) {
    return
  }
  if (!isObject(selector)) {
    throw new SubmapError('SUBMAP_INVALID_REQUEST', `${location} must be an object.`)
  }
  assertKnownKeys(selector, selectorKeys, location)
  for (const key of selectorKeys) {
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

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
