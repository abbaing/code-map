const supportedVersion = 1

export function validateGraphDocument(document) {
  if (!isRecord(document)) {
    throw graphDocumentError(['Graph document must be an object.'])
  }
  const issues = []
  validateHeader(issues, document)
  if (!hasCollections(issues, document)) {
    throw graphDocumentError(issues)
  }
  validateCount(issues, document.stats.nodes, document.nodes.length, 'stats.nodes')
  validateCount(issues, document.stats.edges, document.edges.length, 'stats.edges')
  const nodeIds = validateNodes(issues, document.nodes)
  validateEdges(issues, document.edges, nodeIds)
  if (issues.length > 0) {
    throw graphDocumentError(issues)
  }
  return document
}

function validateHeader(issues, document) {
  if (!Number.isInteger(document.version)) {
    issues.push('version must be an integer.')
  } else if (document.version !== supportedVersion) {
    issues.push(`Only graph document version ${supportedVersion} is supported.`)
  }
  if (typeof document.generatedAt !== 'string' || Number.isNaN(Date.parse(document.generatedAt))) {
    issues.push('generatedAt must be a valid date-time string.')
  }
}

function hasCollections(issues, document) {
  const fields = [
    ['stats', isRecord(document.stats), 'object'],
    ['nodes', Array.isArray(document.nodes), 'array'],
    ['edges', Array.isArray(document.edges), 'array']
  ]
  for (const [name, valid, kind] of fields) {
    if (!valid) {
      issues.push(`${name} must be an ${kind}.`)
    }
  }
  return fields.every(([, valid]) => valid)
}

function validateNodes(issues, nodes) {
  const ids = new Set()
  for (const [index, node] of nodes.entries()) {
    const location = `nodes[${index}]`
    if (!isRecord(node)) {
      issues.push(`${location} must be an object.`)
      continue
    }
    validateFields(issues, node, ['id', 'label', 'type', 'layer', 'module'], location)
    addUniqueId(issues, ids, node.id, location, 'node')
  }
  return ids
}

function validateEdges(issues, edges, nodeIds) {
  const ids = new Set()
  for (const [index, edge] of edges.entries()) {
    const location = `edges[${index}]`
    if (!isRecord(edge)) {
      issues.push(`${location} must be an object.`)
      continue
    }
    validateFields(issues, edge, ['id', 'from', 'to', 'type'], location)
    addUniqueId(issues, ids, edge.id, location, 'edge')
    validateEndpoint(issues, nodeIds, edge.from, `${location}.from`)
    validateEndpoint(issues, nodeIds, edge.to, `${location}.to`)
    validateEdgeId(issues, edge, location)
  }
}

function validateFields(issues, value, fields, location) {
  for (const field of fields) {
    validateNonEmptyString(issues, value[field], `${location}.${field}`)
  }
}

function addUniqueId(issues, ids, id, location, kind) {
  if (typeof id !== 'string' || !id) {
    return
  }
  if (ids.has(id)) {
    issues.push(`${location}.id duplicates ${kind} ${id}.`)
  }
  ids.add(id)
}

function validateEndpoint(issues, nodeIds, id, location) {
  if (typeof id === 'string' && id && !nodeIds.has(id)) {
    issues.push(`${location} references missing node ${id}.`)
  }
}

function validateEdgeId(issues, edge, location) {
  const values = [edge.id, edge.from, edge.to, edge.type]
  if (
    values.every((value) => typeof value === 'string' && value) &&
    edge.id !== `${edge.from}::${edge.type}::${edge.to}`
  ) {
    issues.push(`${location}.id must match its endpoints and type.`)
  }
}

function validateCount(issues, value, expected, location) {
  if (!Number.isInteger(value) || value < 0) {
    issues.push(`${location} must be a non-negative integer.`)
  } else if (value !== expected) {
    issues.push(`${location} must equal ${expected}.`)
  }
}

function validateNonEmptyString(issues, value, location) {
  if (typeof value !== 'string' || !value.trim()) {
    issues.push(`${location} must be a non-empty string.`)
  }
}

function graphDocumentError(issues) {
  const error = new TypeError(`Invalid graph document:\n${issues.map((issue) => `- ${issue}`).join('\n')}`)
  error.issues = Object.freeze([...issues])
  return error
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
