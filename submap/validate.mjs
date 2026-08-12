import { calculateSubmapUid } from '#submap/digest.mjs'
import { validationIssue } from '#submap/errors.mjs'
import { validateSubmapContent } from '#submap/validation-content.mjs'
import { validateSubmapAgainstGraphDocument } from '#submap/validation-graph.mjs'
import { validateSubmapShape } from '#submap/validation-shape.mjs'
import { isRecord } from '#submap/validation-values.mjs'

export function validateSubmap(submap, hash) {
  const errors = []
  const warnings = []
  if (!isRecord(submap)) {
    return {
      valid: false,
      errors: [validationIssue('SUBMAP_INVALID_DOCUMENT', 'Submap must be a JSON object.')],
      warnings
    }
  }
  validateSubmapShape(submap, errors)
  if (errors.length) {
    return { valid: false, errors, warnings }
  }
  validateSubmapContent(submap, errors)
  if (typeof submap.uid !== 'string' || submap.uid !== calculateSubmapUid(submap, hash)) {
    errors.push(validationIssue('SUBMAP_UID_MISMATCH', 'uid does not match the normalized submap content.'))
  }
  if (!/^sha256:[a-f0-9]{64}$/u.test(submap.source.graphDigest)) {
    errors.push(validationIssue('SUBMAP_SOURCE_DIGEST_MISSING', 'source.graphDigest must be a SHA-256 digest.'))
  }
  return { valid: errors.length === 0, errors, warnings }
}

export function validateSubmapAgainstGraph(submap, graph, hash) {
  return validateSubmapAgainstGraphDocument(submap, graph, hash, validateSubmap)
}
