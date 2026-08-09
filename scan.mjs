import path from 'node:path'
import { createSourceReader, readText, walk, maxSourceFileBytes } from './scan-utils.mjs'
import { findComponentDirIndex, isBackTestFile, isTestFile, normalizePath, tsExtensions } from './source-analysis.mjs'
import { Graph } from './graph.mjs'
import { resolveTsImport } from './resolve.mjs'
import { isEntryPoint } from './quality.mjs'
import { createFindingCollector } from './rules/findings.mjs'
import { createScanPipeline, defineScanPhase } from './scan-pipeline.mjs'
import { assertCapabilityRegistry, capabilityInput, deepFreeze } from './templates/contracts.mjs'
import { assertTextWriter } from './writer-contract.mjs'

// ── Phase functions ───────────────────────────────────────────────────────────

function phaseWalkFiles(projectContext, registry) {
  const { projectMap, resolveRepoPath, resolveChildPath, toRepoPath } = projectContext
  const skippedByPath = new Map()
  const walkOptions = {
    maxFileBytes: maxSourceFileBytes,
    ignoredDirs: projectMap.ignoredDirs,
    fileSystem: projectContext.platform.fileSystem,
    resolveChildPath,
    toRepoPath,
    onSkippedFile: (skipped) => skippedByPath.set(skipped.filePath, skipped)
  }
  const byKind = new Map()
  for (const kind of registry.capabilities.fileKinds) {
    byKind.set(kind.id, collectFileKind(projectContext, kind, walkOptions))
  }

  const frontRoot = resolveRepoPath(projectMap.sourceRoots.frontend)
  const backRoot = projectMap.sourceRoots.backend ? resolveRepoPath(projectMap.sourceRoots.backend) : null
  const allFrontFiles = walk(frontRoot, (file) => tsExtensions.includes(path.extname(file)), walkOptions)
  const frontTestFiles = byKind.get('frontend-test') ?? allFrontFiles.filter(isTestFile)
  const frontFiles = byKind.get('frontend-source') ?? allFrontFiles.filter((file) => !isTestFile(file))
  const allBackFiles =
    byKind.get('backend-source') ??
    (backRoot
      ? walk(backRoot, (file) => path.extname(file) === '.cs' && !isBackTestFile(toRepoPath(file)), walkOptions)
      : [])
  const backInternalFragments = [
    projectMap.backend?.dtoPathFragment,
    projectMap.backend?.validatorPathFragment,
    projectMap.backend?.mappingPathFragment
  ].filter(Boolean)
  const backFiles = allBackFiles.filter((file) => {
    const rp = toRepoPath(file)
    return backInternalFragments.every((fragment) => !rp.includes(fragment))
  })
  const skippedFiles = [...skippedByPath.values()].sort((a, b) => a.filePath.localeCompare(b.filePath))
  return { frontFiles, frontTestFiles, backFiles, allBackFiles, skippedFiles }
}

function collectFileKind(projectContext, kind, walkOptions) {
  const { projectMap, resolveRepoPath, toRepoPath } = projectContext
  const root = projectMap.sourceRoots?.[kind.rootKey]
  if (!root) {
    return []
  }
  const rootPath = resolveRepoPath(root)
  const extensions = new Set(kind.extensions ?? [])
  const allFiles = walk(rootPath, (file) => extensions.size === 0 || extensions.has(path.extname(file)), walkOptions)
  return allFiles.filter((file) => {
    const repoPath = toRepoPath(file)
    const test = Boolean(kind.test?.(repoPath, file))
    if (kind.testsOnly) {
      return test
    }
    if (kind.includeTests) {
      return true
    }
    return !test
  })
}

function phaseApplyRuntimeLinks(graph, projectContext) {
  const { projectMap, resolveRepoPath } = projectContext
  const { fileSystem } = projectContext.platform
  if (!projectMap.project.runtimeLinks) {
    return
  }
  const runtimeLinksPath = resolveRepoPath(projectMap.project.runtimeLinks)
  if (!fileSystem.exists(runtimeLinksPath)) {
    return
  }
  const parsed = JSON.parse(readText(runtimeLinksPath, fileSystem, maxSourceFileBytes, projectContext.toRepoPath))
  for (const link of parsed.links ?? []) {
    const from = resolveRuntimeNode(graph, link.from)
    const to = resolveRuntimeNode(graph, link.to)
    if (!from || !to) {
      continue
    }
    graph.addEdge(from, to, link.type ?? 'runtime-link', {
      label: link.reason ?? link.type ?? 'runtime-link',
      confidence: link.confidence ?? 'manual',
      source: 'runtime-links'
    })
  }
}

function phaseApplyCoverage(graph, testFiles, projectContext) {
  const { toRepoPath } = projectContext
  const { fileSystem } = projectContext.platform
  const coverageBySource = new Map()
  const testCaseCountByFile = new Map()

  for (const testFile of testFiles) {
    const covered = new Set()
    for (const candidate of sourceCandidatesForTest(testFile)) {
      if (candidate && fileSystem.exists(candidate) && !isTestFile(candidate)) {
        covered.add(candidate)
      }
    }

    const content = readText(testFile, fileSystem, maxSourceFileBytes, projectContext.toRepoPath)
    testCaseCountByFile.set(toRepoPath(testFile), countTestCases(content))
    const imports = content.matchAll(/(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g)
    for (const match of imports) {
      const resolved = resolveTsImport(testFile, match[1], projectContext)
      if (resolved && !isTestFile(resolved)) {
        covered.add(resolved)
      }
    }

    for (const sourceFile of covered) {
      const sourceId = `file:${toRepoPath(sourceFile)}`
      if (!graph.hasNode(sourceId)) {
        continue
      }
      const testRepoPath = toRepoPath(testFile)
      const current = coverageBySource.get(sourceId) ?? []
      current.push(testRepoPath)
      coverageBySource.set(sourceId, current)
    }
  }

  for (const [sourceId, tests] of coverageBySource) {
    const uniqueTests = [...new Set(tests)].sort()
    const testCaseCount = uniqueTests.reduce((sum, testPath) => sum + (testCaseCountByFile.get(testPath) ?? 0), 0)
    graph.addNode(sourceId, {
      meta: {
        coverage: {
          hasCoverage: true,
          tests: uniqueTests,
          testCaseCount
        }
      }
    })
  }
}

function countTestCases(content) {
  return [...content.matchAll(/(?:^|[^\w$])(?:it|test)(?:\.(?:only|skip|todo|concurrent|each))?\s*\(/g)].length
}

function phaseTrackInternals(graph) {
  trackInternalComponents(graph)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveRuntimeNode(graph, value) {
  if (!value) {
    return null
  }
  if (
    value.startsWith('file:') ||
    value.startsWith('endpoint:') ||
    value.startsWith('table:') ||
    value.startsWith('entity:')
  ) {
    return value
  }
  const repoPath = normalizePath(value)
  if (graph.hasNode(`file:${repoPath}`)) {
    return `file:${repoPath}`
  }
  if (graph.hasNode(value)) {
    return value
  }
  return null
}

function sourceCandidatesForTest(testFile) {
  const ext = path.extname(testFile)
  const baseWithoutExt = testFile.slice(0, -ext.length)
  const withoutTestSuffix = baseWithoutExt.replace(/\.(spec|test)$/u, '')
  const candidates = []

  for (const sourceExt of tsExtensions) {
    candidates.push(`${withoutTestSuffix}${sourceExt}`)
  }

  const basename = path.basename(withoutTestSuffix)
  if (basename === 'index') {
    for (const sourceExt of tsExtensions) {
      candidates.push(path.join(path.dirname(testFile), `index${sourceExt}`))
    }
  }

  return candidates
}

function computeOrphans(graph, projectContext) {
  const incoming = new Map()
  for (const node of graph.allNodes()) {
    incoming.set(node.id, 0)
  }
  for (const edge of graph.allEdges()) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1)
  }

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

function isInternalComponentNode(node) {
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

function findInternalComponentParent(graph, node) {
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
    for (const extension of tsExtensions) {
      const candidateId = `file:${candidateBase}/index${extension}`
      const candidate = graph.getNode(candidateId)
      if (candidate && !isInternalComponentNode(candidate)) {
        return candidateId
      }
    }
  }

  return null
}

function parentPriority(node) {
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

function trackInternalComponents(graph) {
  const internalToParent = new Map()

  for (const node of graph.allNodes()) {
    if (!isInternalComponentNode(node)) {
      continue
    }
    const parentId = findInternalComponentParent(graph, node)
    if (parentId) {
      internalToParent.set(node.id, parentId)
    }
  }

  for (const [internalId, parentId] of internalToParent) {
    const internal = graph.getNode(internalId)
    const parent = graph.getNode(parentId)
    if (!internal || !parent) {
      continue
    }
    addInternalComponentQuality(graph, parent, internal)
    graph.addNode(internalId, {
      meta: {
        internalComponent: {
          parentId,
          role: 'supporting-component'
        }
      }
    })
  }
}

function addInternalComponentQuality(graph, parent, internal) {
  const parentQuality = parent.meta?.quality
  const internalQuality = internal.meta?.quality
  if (!internalQuality) {
    return
  }

  const currentInternalComponents = parentQuality?.internalComponents ?? []
  const internalComponents = [
    ...currentInternalComponents,
    {
      id: internal.id,
      label: internal.label,
      path: internal.path,
      score: internalQuality.score,
      summary: internalQuality.summary,
      cohesion: internalQuality.cohesion,
      coupling: internalQuality.coupling
    }
  ].sort((a, b) => a.score - b.score || a.label.localeCompare(b.label))

  const baseQuality = parentQuality ?? {
    score: internalQuality.score,
    summary: 'Quality inherited from internal components',
    cohesion: internalQuality.cohesion,
    coupling: internalQuality.coupling,
    related: []
  }

  const scores = [parentQuality?.score, ...internalComponents.map((component) => component.score)].filter((score) =>
    Number.isFinite(score)
  )
  const aggregateScore =
    scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : baseQuality.score
  const worst = internalComponents[0]
  const internalSummary = `${internalComponents.length} internal component${internalComponents.length === 1 ? '' : 's'} tracked; worst ${worst.label} ${worst.score}/10`

  graph.addNode(parent.id, {
    meta: {
      quality: {
        ...baseQuality,
        score: aggregateScore,
        summary: `${baseQuality.summary}; ${internalSummary}`,
        internalComponents
      }
    }
  })
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export function createDefaultScanPipeline() {
  return createScanPipeline([
    defineScanPhase({
      id: 'discover-files',
      requires: ['projectContext', 'registry'],
      provides: ['files'],
      run: ({ projectContext, registry }) => ({ files: phaseWalkFiles(projectContext, registry) })
    }),
    defineScanPhase({
      id: 'run-scanners',
      requires: ['graph', 'projectContext', 'registry', 'files', 'findingSink', 'findingSource'],
      provides: ['scannerResults'],
      run: (input) => {
        const capabilities = createScanCapabilities(input)
        return { scannerResults: phaseRunRegisteredScanners(input.registry, capabilities) }
      }
    }),
    defineScanPhase({
      id: 'apply-runtime-links',
      requires: ['graph', 'projectContext'],
      run: ({ graph, projectContext }) => phaseApplyRuntimeLinks(graph, projectContext)
    }),
    defineScanPhase({
      id: 'run-enrichers',
      requires: ['graph', 'projectContext', 'registry', 'files', 'findingSink', 'findingSource', 'scannerResults'],
      run: ({ scannerResults, ...input }) =>
        phaseRunRegisteredEnrichers(input.registry, createScanCapabilities(input), scannerResults)
    }),
    defineScanPhase({
      id: 'finalize-document',
      requires: ['graph', 'projectContext', 'registry', 'effectiveProjectMap', 'files', 'findingSource'],
      provides: ['result'],
      run: (input) => ({ result: finalizeGraphDocument(input) })
    })
  ])
}

function buildGraph(projectContext, registry, pipeline = createDefaultScanPipeline()) {
  const { projectMap } = projectContext
  const effectiveProjectMap = buildEffectiveProjectMap(projectMap, registry)
  const graph = new Graph()
  const { sink: findingSink, source: findingSource } = createFindingCollector(projectMap)

  return pipeline.run({ graph, projectContext, registry, effectiveProjectMap, findingSink, findingSource }).result
}

function finalizeGraphDocument({ graph, projectContext, registry, effectiveProjectMap, files, findingSource }) {
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
      frontFiles: files.frontFiles.length,
      frontTestFiles: files.frontTestFiles.length,
      backFiles: files.backFiles.length,
      hiddenDtoFiles: files.allBackFiles.length - files.backFiles.length,
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

function buildEffectiveProjectMap(projectMap, registry) {
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

function createScanCapabilities({ graph, projectContext, registry, files, findingSink, findingSource }) {
  const { projectMap, toRepoPath } = projectContext
  const sourceReader = createSourceReader(projectContext.platform.fileSystem, toRepoPath)
  return {
    graph,
    projectMap,
    projectContext,
    registry,
    files,
    findingSink,
    findingSource,
    sourceReader,
    controllerFiles: () =>
      files.backFiles.filter((file) =>
        toRepoPath(file).includes(projectMap.backend?.controllerPathFragment ?? '/Controllers/')
      ),
    applyCoverage: () => phaseApplyCoverage(graph, files.frontTestFiles, projectContext),
    trackInternalComponents: () => phaseTrackInternals(graph)
  }
}

function phaseRunRegisteredScanners(registry, capabilities) {
  const results = { frontEndpointIds: Object.freeze([]), controllerEndpoints: Object.freeze([]) }
  for (const scanner of registry.capabilities.scanners) {
    const result = scanner.run(capabilityInput(scanner, { ...capabilities, ...results }))
    if (scanner.assign) {
      results[scanner.assign] = deepFreeze(result ?? [])
    }
  }
  return deepFreeze(results)
}

function phaseRunRegisteredEnrichers(registry, capabilities, scannerResults) {
  const context = { ...capabilities, ...scannerResults }
  for (const enricher of registry.capabilities.enrichers) {
    enricher.run(capabilityInput(enricher, context))
  }
}

export function writeGraph(
  outputPath,
  projectContext,
  { pipeline = createDefaultScanPipeline(), registry, writer } = {}
) {
  if (!projectContext) {
    throw new TypeError('writeGraph requires a ProjectContext.')
  }
  assertCapabilityRegistry(registry)
  assertTextWriter(writer)
  const targetPath = outputPath ?? projectContext.resolveGraphOutputPath()
  const result = buildGraph(projectContext, registry, pipeline)
  writer.writeText(targetPath, `${JSON.stringify(result, null, 2)}\n`)
  removeLegacyDefaultGraph(targetPath, projectContext)
  return result
}

function removeLegacyDefaultGraph(outputPath, projectContext) {
  const { fileSystem } = projectContext.platform
  const managedOutput = path.resolve(projectContext.repoRoot, '.code-map', 'graph.json')
  if (path.resolve(outputPath) !== managedOutput) {
    return
  }
  const legacyOutput = path.resolve(projectContext.repoRoot, 'graph.json')
  if (!fileSystem.exists(legacyOutput)) {
    return
  }
  try {
    const document = JSON.parse(fileSystem.readText(legacyOutput))
    const generatedByCodeMap =
      Number.isInteger(document?.version) &&
      Array.isArray(document?.nodes) &&
      Array.isArray(document?.edges) &&
      document?.projectMap &&
      document?.stats
    if (generatedByCodeMap) {
      fileSystem.remove(legacyOutput)
    }
  } catch {
    /* preserve files that are not recognizable code-map output */
  }
}
