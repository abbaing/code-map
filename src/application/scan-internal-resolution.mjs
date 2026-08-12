import { findComponentDirIndex } from '#core/source-analysis.mjs'

export function isInternalComponentNode(node) {
  if (!node.path) {
    return false
  }
  if (!['component', 'main-component', 'subcomponent', 'page'].includes(node.type)) {
    return false
  }
  const segments = node.path.split('/')
  const dirIndex = findComponentDirIndex(segments)
  if (dirIndex < 0) {
    return false
  }
  return segments.slice(dirIndex + 1, -1).some((segment) => segment.startsWith('_'))
}

export function findInternalComponentParent(graph, node) {
  const pathParent = findPathParent(graph, node)
  if (pathParent) {
    return pathParent
  }

  const relatedIds = []
  for (const edge of graph.allEdges()) {
    if (edge.to === node.id) {
      relatedIds.push(edge.from)
    }
    if (edge.from === node.id) {
      relatedIds.push(edge.to)
    }
  }

  return (
    relatedIds
      .map((id) => graph.getNode(id))
      .filter((related) => related && related.id !== node.id)
      .filter((related) => related.module === node.module && !isInternalComponentNode(related))
      .filter((related) => ['main-component', 'component', 'page', 'route'].includes(related.type))
      .sort((a, b) => parentPriority(a) - parentPriority(b))[0]?.id ?? findModuleParent(graph, node)
  )
}

function findPathParent(graph, node) {
  const segments = node.path.split('/')
  const dirIndex = findComponentDirIndex(segments)
  if (dirIndex < 0) {
    return null
  }

  const relativeSegments = segments.slice(dirIndex + 1, -1)
  const internalIndex = relativeSegments.findIndex((segment) => segment.startsWith('_'))
  if (internalIndex <= 0) {
    return null
  }

  for (let index = internalIndex - 1; index >= 0; index -= 1) {
    const candidateSegments = relativeSegments.slice(0, index + 1)
    const candidateBase = [...segments.slice(0, dirIndex + 1), ...candidateSegments].join('/')
    const candidate = graph
      .allNodes()
      .find((node) => node.path?.startsWith(`${candidateBase}/index.`) && !isInternalComponentNode(node))
    if (candidate) {
      return candidate.id
    }
  }

  return null
}

export function parentPriority(node) {
  if (node.type === 'main-component') {
    return 0
  }
  if (node.type === 'component') {
    return 1
  }
  if (node.type === 'page') {
    return 2
  }
  if (node.type === 'route') {
    return 3
  }
  return 4
}

function findModuleParent(graph, node) {
  return graph
    .allNodes()
    .filter((candidate) => candidate.id !== node.id)
    .filter((candidate) => candidate.module === node.module && !isInternalComponentNode(candidate))
    .filter((candidate) => ['main-component', 'component', 'page', 'route'].includes(candidate.type))
    .sort((a, b) => parentPriority(a) - parentPriority(b) || (a.path ?? '').localeCompare(b.path ?? ''))[0]?.id
}
