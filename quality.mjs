import { getProjectMap } from './config.mjs'

const METRIC_TYPES = new Set(['component', 'main-component', 'subcomponent', 'page', 'route', 'hook', 'service', 'repository', 'controller', 'query', 'command', 'handler'])

export function isEntryPoint(node) {
  const projectMap = getProjectMap()
  return projectMap.frontend.entryPoints.includes(node.path)
    || projectMap.backend?.entryPointSuffixes?.some(suffix => node.path?.endsWith(suffix))
    || node.type === 'table'
}

function clampScore(value) {
  return Math.max(1, Math.min(10, value))
}

function buildCohesionReason(node, internalRelations, externalRelations, outgoingCount, incomingCount) {
  const parts = [
    `${internalRelations} relations inside module ${node.module}`,
    `${externalRelations} relations outside module`,
    `${outgoingCount} outgoing dependencies`,
    `${incomingCount} detected usages`
  ]
  if (isInsideFeatureFolder(node)) {
    parts.push('located inside its feature folder')
  }
  return parts.join('; ')
}

function buildCouplingReason(outgoingCount, externalModules, outgoingExternal) {
  const externalList = [...externalModules].filter(Boolean)
  const parts = [
    `${outgoingCount} outgoing dependencies`,
    `${externalList.length} external modules: ${externalList.length ? externalList.join(', ') : 'none'}`
  ]
  if (outgoingExternal.length > 0) {
    parts.push(`external deps: ${outgoingExternal.slice(0, 6).map(node => node.label).join(', ')}`)
  }
  return parts.join('; ')
}

export function applyQualityMetrics(graph) {
  const incomingByNode = new Map()
  const outgoingByNode = new Map()

  for (const node of graph.allNodes()) {
    incomingByNode.set(node.id, [])
    outgoingByNode.set(node.id, [])
  }

  for (const edge of graph.allEdges()) {
    incomingByNode.get(edge.to)?.push(edge)
    outgoingByNode.get(edge.from)?.push(edge)
  }

  for (const node of graph.allNodes()) {
    if (!METRIC_TYPES.has(node.type)) continue

    const incoming = incomingByNode.get(node.id) ?? []
    const outgoing = outgoingByNode.get(node.id) ?? []
    const scoredIncoming = incoming.filter(edge => isQualityEdge(graph, edge))
    const scoredOutgoing = outgoing.filter(edge => isQualityEdge(graph, edge))
    const relatedEdges = [...scoredIncoming, ...scoredOutgoing]
    const relatedNodes = relatedEdges
      .map(edge => edge.from === node.id ? graph.getNode(edge.to) : graph.getNode(edge.from))
      .filter(Boolean)

    const internalRelations = relatedNodes.filter(related => related.module === node.module).length
    const externalRelations = relatedNodes.filter(related => related.module !== node.module).length
    const outgoingExternal = scoredOutgoing
      .map(edge => graph.getNode(edge.to))
      .filter(related => related && related.module !== node.module && related.module !== getProjectMap().modules.shared)
    const externalModules = new Set(outgoingExternal.map(related => related.module))
    const outgoingCount = scoredOutgoing.length
    const incomingCount = scoredIncoming.length

    let cohesion = 6
    if (relatedNodes.length > 0) {
      cohesion += Math.round((internalRelations / relatedNodes.length) * 3)
    }
    if (isInsideFeatureFolder(node)) cohesion += 1
    if (outgoingCount > 12) cohesion -= 2
    else if (outgoingCount > 8) cohesion -= 1
    if (incomingCount === 0 && !isEntryPoint(node)) cohesion -= 1

    let coupling = 10
    coupling -= Math.max(0, outgoingCount - 4)
    coupling -= externalModules.size * 2
    if (externalRelations > internalRelations && externalRelations > 2) coupling -= 1
    if (outgoingCount === 0) coupling = Math.min(10, coupling + 1)

    const cohesionScore = clampScore(cohesion)
    const couplingScore = clampScore(coupling)
    const score = Math.round((cohesionScore + couplingScore + Math.min(cohesionScore, couplingScore)) / 3)
    const topRelated = relatedNodes
      .slice(0, 8)
      .map(related => ({
        id: related.id,
        label: related.label,
        type: related.type,
        module: related.module
      }))

    graph.addNode(node.id, {
      meta: {
        quality: {
          score,
          summary: `Score ${score}/10; cohesion ${cohesionScore}/10; coupling ${couplingScore}/10`,
          cohesion: {
            score: cohesionScore,
            reason: buildCohesionReason(node, internalRelations, externalRelations, outgoingCount, incomingCount)
          },
          coupling: {
            score: couplingScore,
            reason: buildCouplingReason(outgoingCount, externalModules, outgoingExternal)
          },
          related: topRelated
        }
      }
    })
  }
}

function isInsideFeatureFolder(node) {
  const pattern = getProjectMap().frontend.featureFolderPattern.replace('{module}', node.module)
  return Boolean(node.path?.includes(pattern))
}

function isQualityEdge(graph, edge) {
  const from = graph.getNode(edge.from)
  const to = graph.getNode(edge.to)
  return !isDataNode(from) && !isDataNode(to)
}

function isDataNode(node) {
  return node?.type === 'entity' || node?.type === 'table'
}
