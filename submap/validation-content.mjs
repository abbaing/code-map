import { validationIssue } from '#submap/errors.mjs'
import { ACCESS_LEVELS } from '#submap/selectors.mjs'
import { isRecord } from '#submap/validation-values.mjs'

export function validateSubmapContent(submap, errors) {
  const nodeIds = collectUniqueIds(submap.nodes, 'node', errors)
  const edgeIds = collectUniqueIds(submap.edges, 'edge', errors)
  validateEdges(submap.edges, nodeIds, errors)
  validateAccess(submap.access, nodeIds, errors)
  validateFindings(submap.findings, nodeIds, errors)
  validateOrphans(submap.orphanNodeIds, nodeIds, errors)
  validateBoundaries(submap.boundaries, nodeIds, edgeIds, errors)
  validateSeeds(submap.selection.resolvedSeedNodeIds, nodeIds, errors)
  validateStatistics(submap, errors)
}

function collectUniqueIds(items, kind, errors) {
  const ids = new Set()
  for (const item of items) {
    if (!item?.id || typeof item.id !== 'string') {
      errors.push(validationIssue(`SUBMAP_INVALID_${kind.toUpperCase()}_ID`, `Every ${kind} must have a string id.`))
      continue
    }
    if (ids.has(item.id)) {
      errors.push(
        validationIssue(`SUBMAP_DUPLICATE_${kind.toUpperCase()}_ID`, `Duplicate ${kind} id.`, { id: item.id })
      )
    }
    ids.add(item.id)
  }
  return ids
}

function validateEdges(edges, nodeIds, errors) {
  for (const edge of edges) {
    if (!isRecord(edge)) {
      continue
    }
    if (typeof edge.from !== 'string' || typeof edge.to !== 'string' || !edge.from || !edge.to) {
      errors.push(
        validationIssue('SUBMAP_INVALID_EDGE_ENDPOINT', 'Every edge must have string from and to endpoints.', {
          edgeId: edge.id
        })
      )
    } else if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      errors.push(
        validationIssue('SUBMAP_EDGE_ENDPOINT_MISSING', 'An edge references a node outside the submap.', {
          edgeId: edge.id,
          from: edge.from,
          to: edge.to
        })
      )
    }
  }
}

function validateFindings(findings, nodeIds, errors) {
  for (const finding of findings) {
    if (!isRecord(finding)) {
      errors.push(validationIssue('SUBMAP_INVALID_FINDING', 'Every finding must be an object.'))
    } else if (finding.nodeId && !nodeIds.has(finding.nodeId)) {
      errors.push(
        validationIssue('SUBMAP_FINDING_NODE_MISSING', 'A finding references a node outside the submap.', {
          findingId: finding.id,
          nodeId: finding.nodeId
        })
      )
    }
  }
}

function validateOrphans(orphanIds, nodeIds, errors) {
  for (const id of orphanIds) {
    if (typeof id !== 'string') {
      errors.push(validationIssue('SUBMAP_INVALID_ORPHAN_NODE_ID', 'orphanNodeIds must contain strings.'))
    } else if (!nodeIds.has(id)) {
      errors.push(
        validationIssue('SUBMAP_ORPHAN_NODE_MISSING', 'orphanNodeIds contains an unknown node.', { nodeId: id })
      )
    }
  }
}

function validateBoundaries(boundaries, nodeIds, edgeIds, errors) {
  for (const boundary of boundaries) {
    if (!isRecord(boundary) || !isRecord(boundary.outsideNode)) {
      errors.push(validationIssue('SUBMAP_INVALID_BOUNDARY', 'Every boundary must include an outside node.'))
      continue
    }
    validateBoundaryReferences(boundary, nodeIds, edgeIds, errors)
  }
}

function validateBoundaryReferences(boundary, nodeIds, edgeIds, errors) {
  if (!nodeIds.has(boundary.insideNodeId)) {
    errors.push(
      validationIssue('SUBMAP_BOUNDARY_NODE_MISSING', 'A boundary references an unknown inside node.', {
        edgeId: boundary.edgeId,
        nodeId: boundary.insideNodeId
      })
    )
  }
  if (edgeIds.has(boundary.edgeId)) {
    errors.push(
      validationIssue('SUBMAP_BOUNDARY_EDGE_INCLUDED', 'A boundary edge must not also appear in edges.', {
        edgeId: boundary.edgeId
      })
    )
  }
  if (nodeIds.has(boundary.outsideNode.id)) {
    errors.push(
      validationIssue('SUBMAP_BOUNDARY_OUTSIDE_INCLUDED', 'A boundary outside node must not also be included.', {
        edgeId: boundary.edgeId,
        nodeId: boundary.outsideNode.id
      })
    )
  }
}

function validateSeeds(seeds, nodeIds, errors) {
  for (const nodeId of seeds) {
    if (!nodeIds.has(nodeId)) {
      errors.push(validationIssue('SUBMAP_SEED_NODE_MISSING', 'A resolved seed is absent from nodes.', { nodeId }))
    }
  }
}

function validateAccess(access, nodeIds, errors) {
  if (!ACCESS_LEVELS.includes(access.default)) {
    errors.push(
      validationIssue('SUBMAP_ACCESS_DEFAULT_INVALID', 'access.default is not a supported access level.', {
        access: access.default
      })
    )
  }
  const assigned = new Map()
  for (const level of ACCESS_LEVELS) {
    validateAccessLevel(access, level, nodeIds, assigned, errors)
  }
  for (const nodeId of nodeIds) {
    if (!assigned.has(nodeId)) {
      errors.push(validationIssue('SUBMAP_ACCESS_UNCLASSIFIED', 'A node has no access classification.', { nodeId }))
    }
  }
}

function validateAccessLevel(access, level, nodeIds, assigned, errors) {
  if (!Array.isArray(access[level])) {
    errors.push(validationIssue('SUBMAP_ACCESS_INVALID', `access.${level} must be an array.`))
    return
  }
  for (const nodeId of access[level]) {
    if (!nodeIds.has(nodeId)) {
      errors.push(
        validationIssue('SUBMAP_ACCESS_NODE_MISSING', 'Access classification references an unknown node.', {
          access: level,
          nodeId
        })
      )
    }
    if (assigned.has(nodeId)) {
      errors.push(
        validationIssue('SUBMAP_ACCESS_CONFLICT', 'A node has multiple access classifications.', {
          nodeId,
          access: [assigned.get(nodeId), level]
        })
      )
    }
    assigned.set(nodeId, level)
  }
}

function validateStatistics(submap, errors) {
  const expected = {
    nodes: submap.nodes.length,
    edges: submap.edges.length,
    findings: submap.findings.length,
    boundaries: submap.boundaries.length,
    ...Object.fromEntries(ACCESS_LEVELS.map((level) => [level, submap.access?.[level]?.length ?? 0]))
  }
  for (const [field, value] of Object.entries(expected)) {
    if (submap.statistics?.[field] !== value) {
      errors.push(
        validationIssue('SUBMAP_STATISTICS_MISMATCH', 'A derived statistic is incorrect.', {
          field,
          expected: value,
          actual: submap.statistics?.[field]
        })
      )
    }
  }
}
