import { createSubmapContent } from '#submap/create-content.mjs'
import { buildCatalog, buildStatistics, buildWarnings } from '#submap/create-projection.mjs'
import { resolveCreationSelection } from '#submap/create-selection.mjs'
import { assertGraph } from '#submap/create-validation.mjs'
import { calculateGraphDigest, calculateSubmapUid } from '#submap/digest.mjs'
import { normalizeRequest } from '#submap/selectors.mjs'
import { resolveSubmapStrategies } from '#submap/strategies.mjs'

export function createSubmap(graph, request, options = {}) {
  assertCapabilities(options)
  assertGraph(graph)
  const normalized = normalizeRequest(request)
  const strategies = resolveSubmapStrategies(options.strategies)
  const selection = resolveCreationSelection(graph, normalized, strategies)
  const content = createSubmapContent(graph, normalized, strategies, selection)
  const submap = assembleSubmap(graph, normalized, content, selection.seeds, options)
  submap.uid = calculateSubmapUid(submap, options.hash)
  return submap
}

function assembleSubmap(graph, request, content, seeds, options) {
  return {
    kind: 'code-map/submap',
    schemaVersion: 1,
    id: request.id,
    uid: '',
    revision: request.revision,
    parentUid: request.parentUid,
    createdAt: options.createdAt ?? options.clock.nowIso(),
    source: buildSource(graph, options),
    selection: {
      seeds: request.selectors,
      resolvedSeedNodeIds: [...seeds].sort(),
      traversal: request.traversal,
      exclusions: request.exclusions
    },
    ...content,
    catalog: buildCatalog(graph),
    statistics: buildStatistics(content.nodes, content.edges, content.findings, content.boundaries, content.access),
    warnings: buildWarnings(request, content.boundaries),
    metadata: structuredClone(request.metadata)
  }
}

function buildSource(graph, options) {
  return {
    graphVersion: graph.version,
    graphDigest: calculateGraphDigest(graph, options.hash),
    graphGeneratedAt: graph.generatedAt,
    projectName: graph.projectMap?.project?.name ?? 'Unknown project',
    ...(options.git ? { git: options.git } : {})
  }
}

function assertCapabilities(options) {
  if (!options.createdAt && !options.clock) {
    throw new TypeError('Submap creation requires a clock capability.')
  }
  if (!options.hash) {
    throw new TypeError('Submap creation requires a hash capability.')
  }
}
