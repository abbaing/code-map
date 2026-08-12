import { orderDomainClusterForEdges, seededUnit } from '#viewer/viewer-layout-circular.js'
import { resolveDomainCollisions } from '#viewer/viewer-layout-domain-collisions.js'
import { state } from '#viewer/viewer-state.js'
import { nodeHeight } from '#viewer/viewer-trace.js'

export function forcePlaceDomainCluster(cluster, cardWidth) {
  const model = initializeForceModel(cluster.nodes, cardWidth)
  const edges = state.graph.edges.filter(
    (edge) => edge.type === 'domain-relation' && model.byId.has(edge.from) && model.byId.has(edge.to)
  )
  for (let tick = 0; tick < 180; tick += 1) {
    const alpha = 1 - tick / 180
    applyRepulsion(model, cardWidth, alpha)
    applyAttraction(edges, model, alpha)
    integratePositions(model, alpha)
  }
  return normalizeForcePositions(model, cardWidth)
}

function initializeForceModel(sourceNodes) {
  const nodes = orderDomainClusterForEdges(sourceNodes)
  const positions = new Map()
  const velocities = new Map()
  const anchors = new Map()
  const radius = Math.max(260, Math.sqrt(nodes.length) * 165)
  const center = radius + 260
  nodes.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(nodes.length, 1)
    const ring = radius * (0.9 + seededUnit(`${node.id}:ring`) * 0.14)
    const anchor = { x: center + Math.cos(angle) * ring, y: center + Math.sin(angle) * ring }
    positions.set(node.id, { ...anchor })
    anchors.set(node.id, anchor)
    velocities.set(node.id, { x: 0, y: 0 })
  })
  return { nodes, byId: new Map(nodes.map((node) => [node.id, node])), positions, velocities, anchors, center }
}

function applyRepulsion(model, cardWidth, alpha) {
  for (let first = 0; first < model.nodes.length; first += 1) {
    for (let second = first + 1; second < model.nodes.length; second += 1) {
      const a = model.nodes[first]
      const b = model.nodes[second]
      const vector = normalizedVector(model.positions.get(a.id), model.positions.get(b.id))
      const minDistance = (cardWidth + Math.max(nodeHeight(a, state.view), nodeHeight(b, state.view))) * 0.7
      const repulsion = Math.min(7, 90000 / (vector.distance * vector.distance)) * alpha
      const collision = vector.distance < minDistance ? (minDistance - vector.distance) * 0.04 : 0
      applyForce(model.velocities.get(a.id), -vector.x * (repulsion + collision), -vector.y * (repulsion + collision))
      applyForce(model.velocities.get(b.id), vector.x * (repulsion + collision), vector.y * (repulsion + collision))
    }
  }
}

function applyAttraction(edges, model, alpha) {
  for (const edge of edges) {
    const source = model.byId.get(edge.from)
    const target = model.byId.get(edge.to)
    const vector = normalizedVector(model.positions.get(source.id), model.positions.get(target.id))
    const force = (vector.distance - 390) * 0.003 * alpha
    applyForce(model.velocities.get(source.id), vector.x * force, vector.y * force)
    applyForce(model.velocities.get(target.id), -vector.x * force, -vector.y * force)
  }
}

function integratePositions(model, alpha) {
  for (const node of model.nodes) {
    const position = model.positions.get(node.id)
    const velocity = model.velocities.get(node.id)
    const anchor = model.anchors.get(node.id)
    applyForce(velocity, (anchor.x - position.x) * 0.018 * alpha, (anchor.y - position.y) * 0.018 * alpha)
    applyForce(velocity, (model.center - position.x) * 0.001 * alpha, (model.center - position.y) * 0.001 * alpha)
    position.x += velocity.x
    position.y += velocity.y
    velocity.x *= 0.72
    velocity.y *= 0.72
  }
}

function normalizeForcePositions(model, cardWidth) {
  const boxes = model.nodes.map((node) => ({
    node,
    x: model.positions.get(node.id).x,
    y: model.positions.get(node.id).y,
    width: cardWidth,
    height: nodeHeight(node, state.view)
  }))
  resolveDomainCollisions(boxes)
  const minX = Math.min(...boxes.map((box) => box.x))
  const minY = Math.min(...boxes.map((box) => box.y))
  const maxX = Math.max(...boxes.map((box) => box.x + box.width))
  const maxY = Math.max(...boxes.map((box) => box.y + box.height))
  return {
    positions: new Map(boxes.map((box) => [box.node.id, { x: box.x - minX, y: box.y - minY }])),
    width: maxX - minX,
    height: maxY - minY
  }
}

function normalizedVector(from, to) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const distance = Math.hypot(dx, dy) || 1
  return { x: dx / distance, y: dy / distance, distance }
}

function applyForce(velocity, x, y) {
  velocity.x += x
  velocity.y += y
}
