const metricTypes = new Set([
  'component',
  'main-component',
  'subcomponent',
  'page',
  'route',
  'hook',
  'service',
  'repository',
  'controller',
  'query',
  'command',
  'handler'
])

export function isEntryPoint(node, projectContext) {
  const projectMap = projectContext.projectMap
  return (
    projectMap.frontend.entryPoints.includes(node.path) ||
    projectMap.backend?.entryPointSuffixes?.some((suffix) => node.path?.endsWith(suffix)) ||
    node.type === 'table'
  )
}

export function createQualityIndexes(graph) {
  const incoming = new Map()
  const outgoing = new Map()
  for (const node of graph.allNodes()) {
    incoming.set(node.id, [])
    outgoing.set(node.id, [])
  }
  for (const edge of graph.allEdges()) {
    incoming.get(edge.to)?.push(edge)
    outgoing.get(edge.from)?.push(edge)
  }
  return { incoming, outgoing }
}

export function collectQualityEvidence(graph, node, projectContext, indexes) {
  if (!metricTypes.has(node.type)) {
    return null
  }
  const incoming = (indexes.incoming.get(node.id) ?? []).filter((edge) => isQualityEdge(graph, edge))
  const outgoing = (indexes.outgoing.get(node.id) ?? []).filter((edge) => isQualityEdge(graph, edge))
  const relatedNodes = [...incoming, ...outgoing]
    .map((edge) => (edge.from === node.id ? graph.getNode(edge.to) : graph.getNode(edge.from)))
    .filter(Boolean)
  const projectMap = projectContext.projectMap
  const outgoingExternal = outgoing
    .map((edge) => graph.getNode(edge.to))
    .filter((related) => related && related.module !== node.module && related.module !== projectMap.modules.shared)
  const externalModules = new Set(outgoingExternal.map((related) => related.module))
  const internalRelations = relatedNodes.filter((related) => related.module === node.module).length
  const externalRelations = relatedNodes.filter((related) => related.module !== node.module).length
  const scoring = Object.freeze({
    internalRelations,
    externalRelations,
    outgoingDependencies: outgoing.length,
    incomingUsages: incoming.length,
    relatedRelations: relatedNodes.length,
    externalModuleCount: externalModules.size,
    insideFeatureFolder: isInsideFeatureFolder(node, projectMap),
    entryPoint: isEntryPoint(node, projectContext)
  })
  return { scoring, relatedNodes, outgoingExternal, externalModules }
}

export function describeCohesion(node, evidence) {
  const parts = [
    `${evidence.internalRelations} relations inside module ${node.module}`,
    `${evidence.externalRelations} relations outside module`,
    `${evidence.outgoingDependencies} outgoing dependencies`,
    `${evidence.incomingUsages} detected usages`
  ]
  if (evidence.insideFeatureFolder) {
    parts.push('located inside its feature folder')
  }
  return parts.join('; ')
}

export function describeCoupling(evidence, externalModules, outgoingExternal) {
  const externalList = [...externalModules].filter(Boolean)
  const parts = [
    `${evidence.outgoingDependencies} outgoing dependencies`,
    `${externalList.length} external modules: ${externalList.length ? externalList.join(', ') : 'none'}`
  ]
  if (outgoingExternal.length > 0) {
    parts.push(
      `external deps: ${outgoingExternal
        .slice(0, 6)
        .map((node) => node.label)
        .join(', ')}`
    )
  }
  return parts.join('; ')
}

function isInsideFeatureFolder(node, projectMap) {
  const pattern = projectMap.frontend.featureFolderPattern.replace('{module}', node.module)
  return Boolean(node.path?.includes(pattern))
}

function isQualityEdge(graph, edge) {
  return !isDataNode(graph.getNode(edge.from)) && !isDataNode(graph.getNode(edge.to))
}

function isDataNode(node) {
  return node?.type === 'entity' || node?.type === 'table'
}
