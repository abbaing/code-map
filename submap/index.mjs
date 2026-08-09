import { createSubmap as createSubmapWithCapabilities } from './create.mjs'
import {
  validateSubmap as validateSubmapWithCapabilities,
  validateSubmapAgainstGraph as validateSubmapAgainstGraphWithCapabilities
} from './validate.mjs'
import {
  calculateGraphDigest as calculateGraphDigestWithCapability,
  calculateSubmapUid as calculateSubmapUidWithCapability
} from './digest.mjs'
import { nodePlatform } from '../platform/node.mjs'

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

export { compareSubmaps, inspectSubmap } from './diff.mjs'
export { canonicalStringify } from './digest.mjs'
export { normalizeRequest, globMatches, ACCESS_LEVELS } from './selectors.mjs'
export {
  defaultSelectionStrategy,
  defaultTraversalStrategy,
  defaultAccessStrategy,
  resolveSubmapStrategies
} from './strategies.mjs'
export {
  readGraph,
  readSubmap,
  writeSubmap,
  readJson,
  readJsonStdin,
  writeJsonAtomic,
  defaultSubmapFilename,
  listSubmapFiles
} from './io.mjs'
export { SubmapError } from './errors.mjs'
