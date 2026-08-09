import { createSubmap as createSubmapWithCapabilities } from '#submap/create.mjs'
import {
  validateSubmap as validateSubmapWithCapabilities,
  validateSubmapAgainstGraph as validateSubmapAgainstGraphWithCapabilities
} from '#submap/validate.mjs'
import {
  calculateGraphDigest as calculateGraphDigestWithCapability,
  calculateSubmapUid as calculateSubmapUidWithCapability
} from '#submap/digest.mjs'
import { nodePlatform } from '#platform/node.mjs'

export function createSubmap(graph, request, options = {}) {
  return createSubmapWithCapabilities(graph, request, {
    ...options,
    clock: options.clock ?? nodePlatform.clock,
    hash: options.hash ?? nodePlatform.hash
  })
}

export function validateSubmap(submap, options = {}) {
  return validateSubmapWithCapabilities(submap, options.hash ?? nodePlatform.hash)
}

export function validateSubmapAgainstGraph(submap, graph, options = {}) {
  return validateSubmapAgainstGraphWithCapabilities(submap, graph, options.hash ?? nodePlatform.hash)
}

export function calculateGraphDigest(graph, hash = nodePlatform.hash) {
  return calculateGraphDigestWithCapability(graph, hash)
}

export function calculateSubmapUid(submap, hash = nodePlatform.hash) {
  return calculateSubmapUidWithCapability(submap, hash)
}

export { compareSubmaps, inspectSubmap } from '#submap/diff.mjs'
export { canonicalStringify } from '#submap/digest.mjs'
export { normalizeRequest, globMatches, ACCESS_LEVELS } from '#submap/selectors.mjs'
export {
  defaultSelectionStrategy,
  defaultTraversalStrategy,
  defaultAccessStrategy,
  resolveSubmapStrategies
} from '#submap/strategies.mjs'
export {
  readGraph,
  readSubmap,
  writeSubmap,
  readJson,
  readJsonStdin,
  writeJsonAtomic,
  defaultSubmapFilename,
  listSubmapFiles,
  nodeSubmapRepository
} from '#submap/io.mjs'
export { assertSubmapRepository, submapRepositoryContract } from '#submap/repository.mjs'
export { SubmapError } from '#submap/errors.mjs'
