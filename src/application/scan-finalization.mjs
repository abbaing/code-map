import { maxSourceFileBytes } from '#core/scan-utils.mjs'
import { isEntryPoint } from '#core/quality.mjs'

const orphanTypes = new Set([
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
  'handler',
  'entity',
  'table'
])

export function finalizeGraphDocument({ graph, projectContext, registry, effectiveProjectMap, files, findingSource }) {
  const { projectMap } = projectContext

  const nodes = graph.allNodes().sort((a, b) => a.id.localeCompare(b.id))
  const edges = graph.allEdges().sort((a, b) => a.id.localeCompare(b.id))
  const orphans = computeOrphans(graph, projectContext)
  const findings = findingSource.all()
  const activeFindings = findingSource.active()
  const suppressedFindings = findingSource.suppressed()

  return {
    version: 1,
    projectMap: effectiveProjectMap,
    generatedAt: projectContext.platform.clock.nowIso(),
    stats: {
      nodes: nodes.length,
      edges: edges.length,
      orphans: orphans.length,
      frontFiles: files.of('frontend-source').length,
      frontTestFiles: files.of('frontend-test').length,
      backFiles: countMappedFiles(graph, files.of('backend-source'), projectContext),
      hiddenDtoFiles:
        files.of('backend-source').length - countMappedFiles(graph, files.of('backend-source'), projectContext),
      findings: activeFindings.length,
      errorFindings: activeFindings.filter((finding) => finding.severity === 'error').length,
      suppressedFindings: suppressedFindings.length,
      totalFindings: findings.length,
      skippedFiles: files.skippedFiles.length
    },
    nodes,
    edges,
    orphans,
    findings: activeFindings,
    suppressedFindings,
    templates: registry.templates ?? [],
    architecture: registry.architecture ?? [],
    ruleMetadata: registry.ruleMetadata ?? {},
    warnings: [
      projectMap.project.runtimeLinks
        ? `Static analysis is heuristic. Add runtime-only relationships to ${projectMap.project.runtimeLinks}.`
        : 'Static analysis is heuristic. Configure project.runtimeLinks to add runtime-only relationships.',
      skippedFilesWarning(files.skippedFiles, projectContext)
    ].filter(Boolean)
  }
}

function skippedFilesWarning(skippedFiles, projectContext) {
  if (skippedFiles.length === 0) {
    return null
  }
  const shown = skippedFiles.slice(0, 5).map((item) => projectContext.toRepoPath(item.filePath))
  const remaining = skippedFiles.length - shown.length
  const paths = `${shown.join(', ')}${remaining > 0 ? `, and ${remaining} more` : ''}`
  const limitMiB = maxSourceFileBytes / (1024 * 1024)
  return `${skippedFiles.length} source file${skippedFiles.length === 1 ? '' : 's'} larger than ${limitMiB} MiB ${skippedFiles.length === 1 ? 'was' : 'were'} skipped: ${paths}.`
}

export function buildEffectiveProjectMap(projectMap, registry) {
  return {
    ...projectMap,
    layers: mergeById(registry.layers ?? [], projectMap.layers ?? []),
    types: {
      labels: { ...(registry.types?.labels ?? {}), ...(projectMap.types?.labels ?? {}) },
      colors: { ...(registry.types?.colors ?? {}), ...(projectMap.types?.colors ?? {}) }
    }
  }
}

function mergeById(left = [], right = []) {
  const byId = new Map(left.map((item) => [item.id, item]))
  for (const item of right) {
    byId.set(item.id, { ...(byId.get(item.id) ?? {}), ...item })
  }
  return [...byId.values()]
}

function countMappedFiles(graph, files, projectContext) {
  return files.filter((file) => graph.hasNode(`file:${projectContext.toRepoPath(file)}`)).length
}

function computeOrphans(graph, projectContext) {
  const incoming = new Map(graph.allNodes().map((node) => [node.id, 0]))
  for (const edge of graph.allEdges()) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1)
  }
  return graph
    .allNodes()
    .filter((node) => orphanTypes.has(node.type))
    .filter((node) => (incoming.get(node.id) ?? 0) === 0 && !isEntryPoint(node, projectContext))
    .map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      module: node.module,
      path: node.path,
      reason: 'no incoming links detected'
    }))
}
