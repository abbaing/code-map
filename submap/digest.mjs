import crypto from 'node:crypto'

export function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value))
}

export function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalStringify(value)).digest('hex')}`
}

export function calculateGraphDigest(graph) {
  return sha256({
    version: graph.version,
    nodes: sortedById(graph.nodes),
    edges: sortedById(graph.edges),
    findings: sortedById(graph.findings),
    suppressedFindings: sortedById(graph.suppressedFindings),
    orphanNodeIds: (graph.orphans ?? []).map(item => typeof item === 'string' ? item : item.id).filter(Boolean).sort(),
    templates: [...(graph.templates ?? [])].sort(),
    architecture: sortedById(graph.architecture),
    ruleMetadata: graph.ruleMetadata ?? {},
    catalog: {
      projectName: graph.projectMap?.project?.name,
      moduleLabels: graph.projectMap?.modules?.labels ?? {},
      layers: graph.projectMap?.layers ?? [],
      types: graph.projectMap?.types ?? {}
    }
  })
}

export function calculateSubmapUid(submap) {
  return sha256({
    kind: submap.kind,
    schemaVersion: submap.schemaVersion,
    id: submap.id,
    revision: submap.revision,
    parentUid: submap.parentUid,
    source: {
      graphVersion: submap.source?.graphVersion,
      graphDigest: submap.source?.graphDigest,
      projectName: submap.source?.projectName
    },
    selection: submap.selection,
    access: submap.access,
    nodes: submap.nodes,
    edges: submap.edges,
    findings: submap.findings,
    orphanNodeIds: submap.orphanNodeIds,
    boundaries: submap.boundaries,
    catalog: submap.catalog,
    metadata: submap.metadata
  })
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.keys(value)
      .filter(key => value[key] !== undefined)
      .sort()
      .map(key => [key, canonicalize(value[key])])
  )
}

function sortedById(items = []) {
  return [...items].sort((a, b) => String(a?.id ?? '').localeCompare(String(b?.id ?? '')))
}
