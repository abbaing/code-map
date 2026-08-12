import { validateGraphDocument } from '#core/graph.mjs'
import { calculateGraphDigest, canonicalStringify } from '#submap/digest.mjs'
import { validationIssue } from '#submap/errors.mjs'
import { isRecord } from '#submap/validation-values.mjs'

export function validateSubmapAgainstGraphDocument(submap, graph, hash, validateSubmap) {
  const result = validateSubmap(submap, hash)
  const errors = [...result.errors]
  const warnings = [...result.warnings]
  if (!validateGraph(graph, errors)) {
    return { valid: false, errors, warnings }
  }
  if (!isRecord(submap)) {
    return { valid: false, errors, warnings }
  }
  validateDigest(submap, graph, hash, errors)
  compareDocuments(submap.nodes, graph.nodes, 'node', errors, warnings)
  compareDocuments(submap.edges, graph.edges, 'edge', errors, warnings)
  return { valid: errors.length === 0, errors, warnings }
}

function validateGraph(graph, errors) {
  try {
    validateGraphDocument(graph)
    return true
  } catch (error) {
    errors.push(
      validationIssue('SUBMAP_INVALID_GRAPH', 'A valid code-map graph document is required.', {
        issues: error.issues ?? [error.message]
      })
    )
    return false
  }
}

function validateDigest(submap, graph, hash, errors) {
  const current = calculateGraphDigest(graph, hash)
  if (submap.source?.graphDigest !== current) {
    errors.push(
      validationIssue('SUBMAP_GRAPH_DIGEST_MISMATCH', 'The submap was created from a different graph.', {
        expected: submap.source?.graphDigest,
        actual: current
      })
    )
  }
}

function compareDocuments(submapItems, graphItems, kind, errors, warnings) {
  const sourceItems = new Map(graphItems.map((item) => [item?.id, item]))
  for (const item of Array.isArray(submapItems) ? submapItems : []) {
    if (!isRecord(item)) {
      continue
    }
    const source = sourceItems.get(item.id)
    if (!source) {
      errors.push(missingIssue(kind, item.id))
    } else if (canonicalStringify(source) !== canonicalStringify(item)) {
      warnings.push(changedIssue(kind, item.id))
    }
  }
}

function missingIssue(kind, id) {
  return validationIssue(
    `SUBMAP_SOURCE_${kind.toUpperCase()}_MISSING`,
    `A submap ${kind} is absent from the source graph.`,
    { [`${kind}Id`]: id }
  )
}

function changedIssue(kind, id) {
  return validationIssue(
    `SUBMAP_SOURCE_${kind.toUpperCase()}_CHANGED`,
    `A source ${kind} changed after the submap was created.`,
    { [`${kind}Id`]: id }
  )
}
