import { ACCESS_LEVELS } from '#submap/selectors.mjs'

export function compareSubmaps(previous, current) {
  const nodes = compareIds(previous.nodes, current.nodes)
  const edges = compareIds(previous.edges, current.edges)
  const findings = compareValues(previous.findings, current.findings, findingKey)
  const previousAccess = accessByNode(previous.access)
  const currentAccess = accessByNode(current.access)
  const accessChanges = [...new Set([...previousAccess.keys(), ...currentAccess.keys()])]
    .filter((nodeId) => previousAccess.get(nodeId) !== currentAccess.get(nodeId))
    .sort()
    .map((nodeId) => ({ nodeId, from: previousAccess.get(nodeId) ?? null, to: currentAccess.get(nodeId) ?? null }))

  return {
    kind: 'code-map/submap-diff',
    schemaVersion: 1,
    previous: { id: previous.id, uid: previous.uid, revision: previous.revision },
    current: { id: current.id, uid: current.uid, revision: current.revision },
    nodes,
    edges,
    findings,
    accessChanges,
    perimeter: {
      previousBoundaries: previous.boundaries?.length ?? 0,
      currentBoundaries: current.boundaries?.length ?? 0,
      nodeDelta: nodes.added.length - nodes.removed.length,
      edgeDelta: edges.added.length - edges.removed.length
    },
    changed: Boolean(
      nodes.added.length ||
      nodes.removed.length ||
      edges.added.length ||
      edges.removed.length ||
      findings.added.length ||
      findings.removed.length ||
      accessChanges.length
    )
  }
}

export function inspectSubmap(submap) {
  const modules = [...new Set((submap.nodes ?? []).map((node) => node.module).filter(Boolean))].sort()
  return {
    id: submap.id,
    uid: submap.uid,
    revision: submap.revision,
    parentUid: submap.parentUid,
    projectName: submap.source?.projectName,
    graphDigest: submap.source?.graphDigest,
    createdAt: submap.createdAt,
    seedNodeIds: submap.selection?.resolvedSeedNodeIds ?? [],
    modules,
    statistics: submap.statistics,
    warnings: submap.warnings ?? []
  }
}

function compareIds(previous = [], current = []) {
  const left = new Set(previous.map((item) => item.id))
  const right = new Set(current.map((item) => item.id))
  return {
    added: [...right].filter((id) => !left.has(id)).sort(),
    removed: [...left].filter((id) => !right.has(id)).sort()
  }
}

function compareValues(previous = [], current = [], keyOf) {
  const left = new Set(previous.map(keyOf))
  const right = new Set(current.map(keyOf))
  return {
    added: [...right].filter((value) => !left.has(value)).sort(),
    removed: [...left].filter((value) => !right.has(value)).sort()
  }
}

function findingKey(finding) {
  return [finding.ruleId, finding.nodeId, finding.path, finding.line ?? 0, finding.message].join('::')
}

function accessByNode(access = {}) {
  const result = new Map()
  for (const level of ACCESS_LEVELS) {
    for (const nodeId of access[level] ?? []) {
      result.set(nodeId, level)
    }
  }
  return result
}
