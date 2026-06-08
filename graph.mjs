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
    if (!from || !to || from === to) return
    const id = `${from}::${type}::${to}`
    if (this.edgeMap.has(id)) return
    this.edgeMap.set(id, {
      id,
      from,
      to,
      type,
      label: data.label ?? type,
      confidence: data.confidence ?? 'medium',
      source: data.source ?? 'scanner'
    })
  }

  getNode(id) { return this.nodeMap.get(id) }
  getEdge(id) { return this.edgeMap.get(id) }
  hasNode(id) { return this.nodeMap.has(id) }
  allNodes() { return [...this.nodeMap.values()] }
  allEdges() { return [...this.edgeMap.values()] }
  clear() { this.nodeMap.clear(); this.edgeMap.clear() }
}
