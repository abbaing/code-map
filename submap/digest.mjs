export function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value))
}

export function sha256(value, hash) {
  if (!hash) {
    throw new TypeError('Digest calculation requires a hash capability.')
  }
  return `sha256:${hash.sha256(canonicalStringify(value))}`
}

export function calculateGraphDigest(graph, hash) {
  return sha256(graphDigestInput(graph), hash)
}

export function calculateSubmapUid(submap, hash) {
  return sha256(
    {
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
    },
    hash
  )
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }
  if (!value || typeof value !== 'object') {
    return value
  }
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  )
}

function graphDigestInput(graph) {
  return {
    version: graph.version,
    nodes: sortedById(graph.nodes),
    edges: sortedById(graph.edges),
    findings: sortedById(graph.findings),
    suppressedFindings: sortedById(graph.suppressedFindings),
    orphanNodeIds: orphanIds(graph.orphans),
    templates: [...(graph.templates ?? [])].sort(),
    architecture: sortedById(graph.architecture),
    ruleMetadata: graph.ruleMetadata ?? {},
    catalog: graphCatalog(graph.projectMap)
  }
}

function orphanIds(orphans = []) {
  return orphans
    .map((item) => (typeof item === 'string' ? item : item.id))
    .filter(Boolean)
    .sort()
}

function graphCatalog(projectMap) {
  return {
    projectName: projectMap?.project?.name,
    moduleLabels: projectMap?.modules?.labels ?? {},
    layers: projectMap?.layers ?? [],
    types: projectMap?.types ?? {}
  }
}

function sortedById(items = []) {
  return [...items].sort((a, b) => String(a?.id ?? '').localeCompare(String(b?.id ?? '')))
}
