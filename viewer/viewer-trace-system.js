import { SYSTEM_MODULE_EDGE_TYPES, traceEdgeAllowed } from '#viewer/viewer-trace-policy.js'

export function buildSystemModuleGraph(graph, filteredNodes, formatModule = (module) => module) {
  if (!graph) {
    return { nodes: [], edges: [] }
  }
  const sourceNodes = filteredNodes ?? graph.nodes
  const sourceIds = new Set(sourceNodes.map((node) => node.id))
  const modules = summarizeModules(sourceNodes, formatModule)
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const edges = aggregateModuleEdges(graph, sourceIds, modules, nodeById)
  for (const edge of edges) {
    modules.get(edge.from.slice('module:'.length)).meta.externalRelations++
    modules.get(edge.to.slice('module:'.length)).meta.externalRelations++
  }
  return { nodes: [...modules.values()], edges }
}

function summarizeModules(nodes, formatModule) {
  const modules = new Map()
  for (const node of nodes) {
    const module = node.module || 'shared'
    const summary = modules.get(module) ?? moduleSummary(module, formatModule)
    summary.meta.nodeCount++
    if (node.path?.startsWith('front/')) {
      summary.meta.frontendCount++
    }
    if (node.path?.startsWith('back/')) {
      summary.meta.backendCount++
    }
    summary.meta.findingCount += node.meta?.findings?.length ?? 0
    modules.set(module, summary)
  }
  return modules
}

function aggregateModuleEdges(graph, sourceIds, modules, nodeById) {
  const aggregated = new Map()
  for (const edge of graph.edges) {
    if (!moduleEdgeAllowed(edge, graph, sourceIds, nodeById)) {
      continue
    }
    const fromModule = nodeById.get(edge.from)?.module || 'shared'
    const toModule = nodeById.get(edge.to)?.module || 'shared'
    if (!aggregateCandidate(edge, fromModule, toModule, modules)) {
      continue
    }
    addAggregatedEdge(aggregated, fromModule, toModule, edge.type)
  }
  return [...aggregated.values()].map((edge) => ({ ...edge, relationTypes: [...edge.relationTypes].sort() }))
}

function aggregateCandidate(edge, fromModule, toModule, modules) {
  if (fromModule === toModule || !modules.has(fromModule) || !modules.has(toModule)) {
    return false
  }
  const shared = fromModule === 'shared' || toModule === 'shared'
  return !(shared && ['imports', 'depends-on'].includes(edge.type))
}

function moduleEdgeAllowed(edge, graph, sourceIds, nodeById) {
  return (
    sourceIds.has(edge.from) &&
    sourceIds.has(edge.to) &&
    SYSTEM_MODULE_EDGE_TYPES.has(edge.type) &&
    traceEdgeAllowed(edge, nodeById, graph.edges)
  )
}

function addAggregatedEdge(aggregated, fromModule, toModule, type) {
  const key = `${fromModule}::${toModule}`
  const item = aggregated.get(key) ?? {
    id: `module-edge:${key}`,
    from: `module:${fromModule}`,
    to: `module:${toModule}`,
    type: 'module-dependency',
    count: 0,
    relationTypes: new Set()
  }
  item.count++
  item.relationTypes.add(type)
  aggregated.set(key, item)
}

function moduleSummary(module, formatModule) {
  return {
    id: `module:${module}`,
    label: formatModule(module),
    type: 'module',
    layer: 'module-overview',
    module,
    meta: { nodeCount: 0, frontendCount: 0, backendCount: 0, findingCount: 0, externalRelations: 0 }
  }
}
