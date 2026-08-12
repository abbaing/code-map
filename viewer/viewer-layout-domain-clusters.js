import { compareDomainNodes } from '#viewer/viewer-layout-domain-order.js'
import { state } from '#viewer/viewer-state.js'
import { formatModule, unique } from '#viewer/viewer-utils.js'

export function buildDomainClusters(nodes, domainOrder) {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const adjacency = relationAdjacency(nodes, byId)
  const seen = new Set()
  const relationClusters = []
  const isolatedByModule = new Map()
  for (const node of nodes) {
    if (seen.has(node.id)) {
      continue
    }
    const clusterNodes = collectCluster(node.id, adjacency, byId, seen).sort((a, b) =>
      compareDomainNodes(a, b, domainOrder)
    )
    if (clusterNodes.length > 1) {
      addRelationCluster(relationClusters, clusterNodes, adjacency)
    } else {
      addIsolatedNode(isolatedByModule, clusterNodes[0])
    }
  }
  const isolatedClusters = [...isolatedByModule.entries()].map(([module, clusterNodes]) => ({
    key: `isolated-${module}`,
    label: `${formatModule(module)} standalone`,
    nodes: clusterNodes.filter(Boolean).sort((a, b) => compareDomainNodes(a, b, domainOrder)),
    degree: 0
  }))
  return [...relationClusters, ...isolatedClusters]
    .filter((cluster) => cluster.nodes.length > 0)
    .sort((a, b) => b.degree - a.degree || b.nodes.length - a.nodes.length || a.label.localeCompare(b.label))
}

function relationAdjacency(nodes, byId) {
  const adjacency = new Map(nodes.map((node) => [node.id, new Set()]))
  for (const edge of state.graph.edges) {
    if (edge.type !== 'domain-relation' || !byId.has(edge.from) || !byId.has(edge.to)) {
      continue
    }
    adjacency.get(edge.from)?.add(edge.to)
    adjacency.get(edge.to)?.add(edge.from)
  }
  return adjacency
}

function collectCluster(startId, adjacency, byId, seen) {
  const stack = [startId]
  const ids = []
  seen.add(startId)
  while (stack.length) {
    const id = stack.pop()
    ids.push(id)
    for (const next of adjacency.get(id) ?? []) {
      if (seen.has(next)) {
        continue
      }
      seen.add(next)
      stack.push(next)
    }
  }
  return ids.map((id) => byId.get(id)).filter(Boolean)
}

function addRelationCluster(clusters, nodes, adjacency) {
  const modules = unique(nodes.map(domainEntityModule)).sort()
  clusters.push({
    key: `relations-${clusters.length}`,
    label: domainClusterLabel(nodes, modules),
    nodes,
    degree: nodes.reduce((sum, item) => sum + (adjacency.get(item.id)?.size ?? 0), 0)
  })
}

function addIsolatedNode(isolatedByModule, node) {
  const module = domainEntityModule(node)
  const nodes = isolatedByModule.get(module) ?? []
  nodes.push(node)
  isolatedByModule.set(module, nodes)
}

function domainClusterLabel(nodes, modules) {
  const names = nodes.slice(0, 2).map((node) => node.label)
  const suffix = nodes.length > names.length ? ` +${nodes.length - names.length}` : ''
  const moduleLabel = modules.length > 1 ? `${modules.length} modules` : formatModule(modules[0] ?? 'shared')
  return `${names.join(' / ')}${suffix} (${moduleLabel})`
}

function domainEntityModule(node) {
  const modules = configuredModules()
  const pathModule = matchPathModule(node, modules.backendEntityDomainPattern)
  if (pathModule) {
    return pathModule.toLowerCase().replace(/[\s._]+/g, '-')
  }
  return node?.module ?? modules.shared ?? 'shared'
}

function configuredModules() {
  return state.graph.projectMap?.modules ?? {}
}

function matchPathModule(node, pattern) {
  return pattern ? node?.path?.match(new RegExp(pattern))?.[1] : null
}
