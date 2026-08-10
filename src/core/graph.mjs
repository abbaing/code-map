export class Graph {
  constructor() {
    this.nodeMap = new Map()
    this.edgeMap = new Map()
  }

  addNode(id, data) {
    const existing = this.nodeMap.get(id) ?? {}
    this.nodeMap.set(id, {
      id,
      label: data.label ?? existing.label ?? id,
      type: data.type ?? existing.type ?? 'unknown',
      layer: data.layer ?? existing.layer ?? 'unknown',
      module: data.module ?? existing.module ?? 'shared',
      path: data.path ?? existing.path,
      meta: { ...(existing.meta ?? {}), ...(data.meta ?? {}) }
    })
  }

  addEdge(from, to, type, data = {}) {
    if (!from || !to || from === to) {
      return
    }
    if (!this.nodeMap.has(from) || !this.nodeMap.has(to)) {
      return
    }
    const id = `${from}::${type}::${to}`
    if (this.edgeMap.has(id)) {
      return
    }
    this.edgeMap.set(id, {
      id,
      from,
      to,
      type,
      label: data.label ?? type,
      confidence: data.confidence ?? 'medium',
      source: data.source ?? 'scanner',
      evidence: data.evidence
    })
  }

  getNode(id) {
    return this.nodeMap.get(id)
  }
  getEdge(id) {
    return this.edgeMap.get(id)
  }
  hasNode(id) {
    return this.nodeMap.has(id)
  }
  allNodes() {
    return [...this.nodeMap.values()]
  }
  allEdges() {
    return [...this.edgeMap.values()]
  }
  clear() {
    this.nodeMap.clear()
    this.edgeMap.clear()
  }
}

const supportedGraphDocumentVersion = 1

export function validateGraphDocument(document) {
  const issues = []
  if (!isRecord(document)) {
    throw graphDocumentError(['Graph document must be an object.'])
  }

  if (!Number.isInteger(document.version)) {
    issues.push('version must be an integer.')
  } else if (document.version !== supportedGraphDocumentVersion) {
    issues.push(`Only graph document version ${supportedGraphDocumentVersion} is supported.`)
  }
  if (typeof document.generatedAt !== 'string' || Number.isNaN(Date.parse(document.generatedAt))) {
    issues.push('generatedAt must be a valid date-time string.')
  }
  const hasStats = isRecord(document.stats)
  const hasNodes = Array.isArray(document.nodes)
  const hasEdges = Array.isArray(document.edges)
  if (!hasStats) {
    issues.push('stats must be an object.')
  }
  if (!hasNodes) {
    issues.push('nodes must be an array.')
  }
  if (!hasEdges) {
    issues.push('edges must be an array.')
  }
  if (!hasStats || !hasNodes || !hasEdges) {
    throw graphDocumentError(issues)
  }

  validateCount(issues, document.stats.nodes, document.nodes.length, 'stats.nodes')
  validateCount(issues, document.stats.edges, document.edges.length, 'stats.edges')

  const nodeIds = new Set()
  for (const [index, node] of document.nodes.entries()) {
    const location = `nodes[${index}]`
    if (!isRecord(node)) {
      issues.push(`${location} must be an object.`)
      continue
    }
    for (const key of ['id', 'label', 'type', 'layer', 'module']) {
      validateNonEmptyString(issues, node[key], `${location}.${key}`)
    }
    if (typeof node.id === 'string' && node.id) {
      if (nodeIds.has(node.id)) {
        issues.push(`${location}.id duplicates node ${node.id}.`)
      }
      nodeIds.add(node.id)
    }
  }

  const edgeIds = new Set()
  for (const [index, edge] of document.edges.entries()) {
    const location = `edges[${index}]`
    if (!isRecord(edge)) {
      issues.push(`${location} must be an object.`)
      continue
    }
    for (const key of ['id', 'from', 'to', 'type']) {
      validateNonEmptyString(issues, edge[key], `${location}.${key}`)
    }
    if (typeof edge.id === 'string' && edge.id) {
      if (edgeIds.has(edge.id)) {
        issues.push(`${location}.id duplicates edge ${edge.id}.`)
      }
      edgeIds.add(edge.id)
    }
    if (typeof edge.from === 'string' && edge.from && !nodeIds.has(edge.from)) {
      issues.push(`${location}.from references missing node ${edge.from}.`)
    }
    if (typeof edge.to === 'string' && edge.to && !nodeIds.has(edge.to)) {
      issues.push(`${location}.to references missing node ${edge.to}.`)
    }
    if (
      [edge.id, edge.from, edge.to, edge.type].every((value) => typeof value === 'string' && value) &&
      edge.id !== `${edge.from}::${edge.type}::${edge.to}`
    ) {
      issues.push(`${location}.id must match its endpoints and type.`)
    }
  }

  if (issues.length > 0) {
    throw graphDocumentError(issues)
  }
  return document
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
