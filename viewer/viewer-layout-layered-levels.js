import { state } from '#viewer/viewer-state.js'

export function computeLayerLevels(nodes, layers, layoutLayerByNode) {
  const levels = new Map(layers.map((layer) => [layer, 1]))
  const moduleGroups = new Map()
  for (const node of nodes) {
    const key = `${node.module || 'shared'}::${layoutLayerByNode.get(node.id) ?? node.layer ?? 'unknown'}`
    const group = moduleGroups.get(key) ?? []
    group.push(node)
    moduleGroups.set(key, group)
  }
  for (const group of moduleGroups.values()) {
    const groupLevels = computeLevelByNode(group, layoutLayerByNode)
    for (const node of group) {
      const layer = layoutLayerByNode.get(node.id) ?? node.layer ?? 'unknown'
      levels.set(layer, Math.max(levels.get(layer) ?? 1, (groupLevels.get(node.id) ?? 0) + 1))
    }
  }
  return levels
}

export function computeModuleLevelByNode(moduleGroup, layoutLayerByNode) {
  return computeLevelByNode([...moduleGroup.values()].flat(), layoutLayerByNode)
}

function computeLevelByNode(nodes, layoutLayerByNode) {
  const visible = new Set(nodes.map((node) => node.id))
  const predecessors = new Map(nodes.map((node) => [node.id, []]))
  for (const edge of state.graph.edges) {
    if (!visible.has(edge.from) || !visible.has(edge.to)) {
      continue
    }
    if (layoutLayerByNode.get(edge.from) !== layoutLayerByNode.get(edge.to)) {
      continue
    }
    predecessors.get(edge.to)?.push(edge.from)
  }
  const memo = new Map()
  const visiting = new Set()
  const depth = (id) => {
    if (memo.has(id)) {
      return memo.get(id)
    }
    if (visiting.has(id)) {
      return 0
    }
    visiting.add(id)
    const value = Math.max(0, ...(predecessors.get(id) ?? []).map((parent) => depth(parent) + 1))
    visiting.delete(id)
    memo.set(id, value)
    return value
  }
  for (const node of nodes) {
    depth(node.id)
  }
  return memo
}
