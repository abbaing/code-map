import { validationIssue } from '#submap/errors.mjs'
import { isRecord } from '#submap/validation-values.mjs'

const records = [
  ['source', 'SUBMAP_SOURCE_MISSING'],
  ['selection', 'SUBMAP_SELECTION_MISSING'],
  ['access', 'SUBMAP_ACCESS_MISSING'],
  ['catalog', 'SUBMAP_CATALOG_MISSING'],
  ['statistics', 'SUBMAP_STATISTICS_MISSING'],
  ['metadata', 'SUBMAP_METADATA_MISSING']
]
const arrays = [
  ['nodes', 'SUBMAP_INVALID_NODES'],
  ['edges', 'SUBMAP_INVALID_EDGES'],
  ['findings', 'SUBMAP_INVALID_FINDINGS'],
  ['orphanNodeIds', 'SUBMAP_INVALID_ORPHANS'],
  ['boundaries', 'SUBMAP_INVALID_BOUNDARIES'],
  ['warnings', 'SUBMAP_INVALID_WARNINGS']
]

export function validateSubmapShape(submap, errors) {
  validateIdentity(submap, errors)
  for (const [property, code] of records) {
    if (!isRecord(submap[property])) {
      errors.push(validationIssue(code, `${property} must be an object.`))
    }
  }
  for (const [property, code] of arrays) {
    if (!Array.isArray(submap[property])) {
      errors.push(validationIssue(code, `${property} must be an array.`))
    }
  }
  if (isRecord(submap.selection) && !Array.isArray(submap.selection.resolvedSeedNodeIds)) {
    errors.push(validationIssue('SUBMAP_INVALID_RESOLVED_SEEDS', 'selection.resolvedSeedNodeIds must be an array.'))
  }
}

function validateIdentity(submap, errors) {
  if (submap.kind !== 'code-map/submap') {
    errors.push(validationIssue('SUBMAP_INVALID_KIND', 'kind must be code-map/submap.'))
  }
  if (submap.schemaVersion !== 1) {
    errors.push(
      validationIssue('SUBMAP_SCHEMA_INCOMPATIBLE', 'Only submap schema version 1 is supported.', {
        schemaVersion: submap.schemaVersion
      })
    )
  }
  if (typeof submap.id !== 'string' || !submap.id.trim()) {
    errors.push(validationIssue('SUBMAP_INVALID_ID', 'id must be a non-empty string.'))
  }
  if (!Number.isInteger(submap.revision) || submap.revision < 1) {
    errors.push(validationIssue('SUBMAP_INVALID_REVISION', 'revision must be a positive integer.'))
  }
  if (submap.parentUid != null && !/^sha256:[a-f0-9]{64}$/.test(submap.parentUid)) {
    errors.push(validationIssue('SUBMAP_INVALID_PARENT_UID', 'parentUid must be null or a SHA-256 identifier.'))
  }
  if (typeof submap.createdAt !== 'string' || Number.isNaN(Date.parse(submap.createdAt))) {
    errors.push(validationIssue('SUBMAP_INVALID_CREATED_AT', 'createdAt must be an ISO date-time string.'))
  }
}
