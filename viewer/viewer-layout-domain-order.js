import { state } from '#viewer/viewer-state.js'

export function computeDomainOrder(nodes) {
  const graph = domainAdjacency(nodes)
  const components = connectedComponents(nodes, graph.adjacency)
  components.sort((a, b) => compareComponents(a, b, graph.adjacency, graph.byId))
  const order = new Map()
  let index = 0
  for (const component of components) {
    const sorted = component
      .map((id) => graph.byId.get(id))
      .filter(Boolean)
      .sort((a, b) => compareDomainDegree(a, b, graph))
    for (const node of sorted) {
      order.set(node.id, index++)
    }
  }
  return order
}

export function compareDomainNodes(a, b, domainOrder) {
  return (domainOrder.get(a.id) ?? 9999) - (domainOrder.get(b.id) ?? 9999) || a.label.localeCompare(b.label)
}

function domainAdjacency(nodes) {
  const visible = new Set(nodes.map((node) => node.id))
  const adjacency = new Map(nodes.map((node) => [node.id, new Set()]))
  const incoming = new Map(nodes.map((node) => [node.id, 0]))
  const outgoing = new Map(nodes.map((node) => [node.id, 0]))
  for (const edge of state.graph.edges) {
    if (edge.type !== 'domain-relation' || !visible.has(edge.from) || !visible.has(edge.to)) {
      continue
    }
    adjacency.get(edge.from)?.add(edge.to)
    adjacency.get(edge.to)?.add(edge.from)
    outgoing.set(edge.from, (outgoing.get(edge.from) ?? 0) + 1)
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1)
  }
  return { adjacency, incoming, outgoing, byId: new Map(nodes.map((node) => [node.id, node])) }
}

function connectedComponents(nodes, adjacency) {
  const components = []
  const seen = new Set()
  for (const node of nodes) {
    if (seen.has(node.id)) {
      continue
    }
    const stack = [node.id]
    const component = []
    seen.add(node.id)
    while (stack.length) {
      const id = stack.pop()
      component.push(id)
      addUnseenNeighbors(adjacency.get(id), seen, stack)
    }
    components.push(component)
  }
  return components
}

function addUnseenNeighbors(neighbors, seen, stack) {
  for (const next of neighbors ?? []) {
    if (seen.has(next)) {
      continue
    }
    seen.add(next)
    stack.push(next)
  }
}

function compareComponents(a, b, adjacency, byId) {
  const degree = (component) => component.reduce((sum, id) => sum + (adjacency.get(id)?.size ?? 0), 0)
  return degree(b) - degree(a) || componentLabel(a, byId).localeCompare(componentLabel(b, byId))
}

function compareDomainDegree(a, b, graph) {
  const aDegree = graph.adjacency.get(a.id)?.size ?? 0
  const bDegree = graph.adjacency.get(b.id)?.size ?? 0
  const aOutgoing = graph.outgoing.get(a.id) ?? 0
  const bOutgoing = graph.outgoing.get(b.id) ?? 0
  const aIncoming = graph.incoming.get(a.id) ?? 0
  const bIncoming = graph.incoming.get(b.id) ?? 0
  return bDegree - aDegree || bOutgoing - aOutgoing || aIncoming - bIncoming || a.label.localeCompare(b.label)
}

function componentLabel(component, byId) {
  return (
    component
      .map((id) => byId.get(id)?.label)
      .filter(Boolean)
      .sort()[0] ?? ''
  )
}
