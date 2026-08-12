import { SubmapError } from '#submap/errors.mjs'
import { validateRequestShape } from '#submap/selector-validation.mjs'

export const ACCESS_LEVELS = ['editable', 'readable', 'external', 'forbidden', 'generated']

export function normalizeRequest(request = {}) {
  validateRequestShape(request, ACCESS_LEVELS)
  const id = String(request.id ?? '').trim()
  assertId(id)
  const direction = request.traversal?.direction ?? 'both'
  assertDirection(direction)
  const maxDepth = request.traversal?.maxDepth ?? 1
  assertDepth(maxDepth)
  const defaultAccess = request.access?.default ?? 'readable'
  assertAccess(defaultAccess)
  assertParentUid(request.parentUid)
  return normalizedRequest(request, { id, direction, maxDepth, defaultAccess })
}

function normalizedRequest(request, values) {
  return {
    id: values.id,
    revision: normalizeRevision(request.revision),
    parentUid: request.parentUid ?? null,
    selectors: normalizeSelector(request.selectors),
    traversal: {
      direction: values.direction,
      maxDepth: values.maxDepth,
      edgeTypes: strings(request.traversal?.edgeTypes),
      excludedEdgeTypes: strings(request.traversal?.excludedEdgeTypes)
    },
    exclusions: normalizeSelector(request.exclusions),
    access: {
      default: values.defaultAccess,
      ...Object.fromEntries(ACCESS_LEVELS.map((level) => [level, normalizeSelector(request.access?.[level])]))
    },
    metadata: isObject(request.metadata) ? request.metadata : {}
  }
}

export function selectorIsEmpty(selector) {
  return ['nodeIds', 'paths', 'modules', 'layers', 'types'].every((key) => selector[key].length === 0)
}

function normalizeSelector(selector = {}) {
  return {
    nodeIds: strings(selector?.nodeIds ?? selector?.nodes),
    paths: strings(selector?.paths),
    modules: strings(selector?.modules),
    layers: strings(selector?.layers),
    types: strings(selector?.types)
  }
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

function assertId(id) {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(id)) {
    throw new SubmapError('SUBMAP_INVALID_ID', 'Submap id must use letters, numbers, dots, underscores, or hyphens.', {
      id
    })
  }
}

function assertDirection(direction) {
  if (!['incoming', 'outgoing', 'both'].includes(direction)) {
    throw new SubmapError('SUBMAP_INVALID_DIRECTION', 'Traversal direction must be incoming, outgoing, or both.', {
      direction
    })
  }
}

function assertDepth(maxDepth) {
  if (!Number.isInteger(maxDepth) || maxDepth < 0) {
    throw new SubmapError('SUBMAP_INVALID_DEPTH', 'Traversal maxDepth must be a non-negative integer.', { maxDepth })
  }
}

function assertAccess(access) {
  if (!ACCESS_LEVELS.includes(access)) {
    throw new SubmapError('SUBMAP_INVALID_ACCESS', 'Unknown default access level.', { access })
  }
}

function assertParentUid(parentUid) {
  if (parentUid != null && !/^sha256:[a-f0-9]{64}$/.test(parentUid)) {
    throw new SubmapError('SUBMAP_INVALID_PARENT_UID', 'parentUid must be a SHA-256 identifier.', { parentUid })
  }
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
