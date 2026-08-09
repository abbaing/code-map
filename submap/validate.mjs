import { calculateGraphDigest, calculateSubmapUid, canonicalStringify } from './digest.mjs'
import { ACCESS_LEVELS } from './selectors.mjs'
import { validationIssue } from './errors.mjs'

export function validateSubmap(submap, hash) {
  const errors = []
  const warnings = []
  if (!submap || typeof submap !== 'object') {
    return {
      valid: false,
      errors: [validationIssue('SUBMAP_INVALID_DOCUMENT', 'Submap must be a JSON object.')],
      warnings
    }
  }
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
  if (!submap.id || typeof submap.id !== 'string') {
    errors.push(validationIssue('SUBMAP_INVALID_ID', 'id must be a non-empty string.'))
  }
  if (!Number.isInteger(submap.revision) || submap.revision < 1) {
    errors.push(validationIssue('SUBMAP_INVALID_REVISION', 'revision must be a positive integer.'))
  }
  if (submap.parentUid != null && !/^sha256:[a-f0-9]{64}$/.test(submap.parentUid)) {
    errors.push(validationIssue('SUBMAP_INVALID_PARENT_UID', 'parentUid must be null or a SHA-256 identifier.'))
  }
  if (!submap.createdAt || Number.isNaN(Date.parse(submap.createdAt))) {
    errors.push(validationIssue('SUBMAP_INVALID_CREATED_AT', 'createdAt must be an ISO date-time string.'))
  }
  if (!Array.isArray(submap.nodes)) {
    errors.push(validationIssue('SUBMAP_INVALID_NODES', 'nodes must be an array.'))
  }
  if (!Array.isArray(submap.edges)) {
    errors.push(validationIssue('SUBMAP_INVALID_EDGES', 'edges must be an array.'))
  }
  if (errors.length) {
    return { valid: false, errors, warnings }
  }

  const nodeIds = collectUniqueIds(submap.nodes, 'node', errors)
  const edgeIds = collectUniqueIds(submap.edges, 'edge', errors)
  for (const edge of submap.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      errors.push(
        validationIssue('SUBMAP_EDGE_ENDPOINT_MISSING', 'An edge references a node outside the submap.', {
          edgeId: edge.id,
          from: edge.from,
          to: edge.to
        })
      )
    }
  }

  validateAccess(submap.access, nodeIds, errors)
  for (const finding of submap.findings ?? []) {
    if (finding.nodeId && !nodeIds.has(finding.nodeId)) {
      errors.push(
        validationIssue('SUBMAP_FINDING_NODE_MISSING', 'A finding references a node outside the submap.', {
          findingId: finding.id,
          nodeId: finding.nodeId
        })
      )
    }
  }
  for (const id of submap.orphanNodeIds ?? []) {
    if (!nodeIds.has(id)) {
      errors.push(
        validationIssue('SUBMAP_ORPHAN_NODE_MISSING', 'orphanNodeIds contains an unknown node.', { nodeId: id })
      )
    }
  }
  for (const boundary of submap.boundaries ?? []) {
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
    if (nodeIds.has(boundary.outsideNode?.id)) {
      errors.push(
        validationIssue('SUBMAP_BOUNDARY_OUTSIDE_INCLUDED', 'A boundary outside node must not also be included.', {
          edgeId: boundary.edgeId,
          nodeId: boundary.outsideNode.id
        })
      )
    }
  }

  for (const nodeId of submap.selection?.resolvedSeedNodeIds ?? []) {
    if (!nodeIds.has(nodeId)) {
      errors.push(validationIssue('SUBMAP_SEED_NODE_MISSING', 'A resolved seed is absent from nodes.', { nodeId }))
    }
  }

  validateStatistics(submap, errors)
  if (typeof submap.uid !== 'string' || submap.uid !== calculateSubmapUid(submap, hash)) {
    errors.push(validationIssue('SUBMAP_UID_MISMATCH', 'uid does not match the normalized submap content.'))
  }
  if (!submap.source?.graphDigest?.startsWith('sha256:')) {
    errors.push(validationIssue('SUBMAP_SOURCE_DIGEST_MISSING', 'source.graphDigest must be a SHA-256 digest.'))
  }
  return { valid: errors.length === 0, errors, warnings }
}

export function validateSubmapAgainstGraph(submap, graph, hash) {
  const result = validateSubmap(submap, hash)
  const errors = [...result.errors]
  const warnings = [...result.warnings]
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    errors.push(validationIssue('SUBMAP_INVALID_GRAPH', 'A graph with nodes and edges is required.'))
    return { valid: false, errors, warnings }
  }

  const currentDigest = calculateGraphDigest(graph, hash)
  if (submap.source?.graphDigest !== currentDigest) {
    errors.push(
      validationIssue('SUBMAP_GRAPH_DIGEST_MISMATCH', 'The submap was created from a different graph.', {
        expected: submap.source?.graphDigest,
        actual: currentDigest
      })
    )
  }

  const sourceNodes = new Map(graph.nodes.map((node) => [node.id, node]))
  const sourceEdges = new Map(graph.edges.map((edge) => [edge.id, edge]))
  for (const node of submap.nodes ?? []) {
    const source = sourceNodes.get(node.id)
    if (!source) {
      errors.push(
        validationIssue('SUBMAP_SOURCE_NODE_MISSING', 'A submap node is absent from the source graph.', {
          nodeId: node.id
        })
      )
    } else if (canonicalStringify(source) !== canonicalStringify(node)) {
      warnings.push(
        validationIssue('SUBMAP_SOURCE_NODE_CHANGED', 'A source node changed after the submap was created.', {
          nodeId: node.id
        })
      )
    }
  }
  for (const edge of submap.edges ?? []) {
    const source = sourceEdges.get(edge.id)
    if (!source) {
      errors.push(
        validationIssue('SUBMAP_SOURCE_EDGE_MISSING', 'A submap edge is absent from the source graph.', {
          edgeId: edge.id
        })
      )
    } else if (canonicalStringify(source) !== canonicalStringify(edge)) {
      warnings.push(
        validationIssue('SUBMAP_SOURCE_EDGE_CHANGED', 'A source edge changed after the submap was created.', {
          edgeId: edge.id
        })
      )
    }
  }
  return { valid: errors.length === 0, errors, warnings }
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

function validateAccess(access, nodeIds, errors) {
  if (!access || typeof access !== 'object') {
    errors.push(validationIssue('SUBMAP_ACCESS_MISSING', 'access is required.'))
    return
  }
  if (!ACCESS_LEVELS.includes(access.default)) {
    errors.push(
      validationIssue('SUBMAP_ACCESS_DEFAULT_INVALID', 'access.default is not a supported access level.', {
        access: access.default
      })
    )
  }
  const assigned = new Map()
  for (const level of ACCESS_LEVELS) {
    if (!Array.isArray(access[level])) {
      errors.push(validationIssue('SUBMAP_ACCESS_INVALID', `access.${level} must be an array.`))
      continue
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
  for (const nodeId of nodeIds) {
    if (!assigned.has(nodeId)) {
      errors.push(validationIssue('SUBMAP_ACCESS_UNCLASSIFIED', 'A node has no access classification.', { nodeId }))
    }
  }
}

function validateStatistics(submap, errors) {
  const expected = {
    nodes: submap.nodes.length,
    edges: submap.edges.length,
    findings: (submap.findings ?? []).length,
    boundaries: (submap.boundaries ?? []).length,
    ...Object.fromEntries(ACCESS_LEVELS.map((level) => [level, submap.access?.[level]?.length ?? 0]))
  }
  for (const [key, value] of Object.entries(expected)) {
    if (submap.statistics?.[key] !== value) {
      errors.push(
        validationIssue('SUBMAP_STATISTICS_MISMATCH', 'A derived statistic is incorrect.', {
          field: key,
          expected: value,
          actual: submap.statistics?.[key]
        })
      )
    }
  }
}
