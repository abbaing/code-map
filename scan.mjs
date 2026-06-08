import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { repoRoot, toRepoPath, readText, normalizePath, walk, isTestFile, isBackTestFile, tsExtensions, findComponentDirIndex } from './scan-utils.mjs'
import { getConfigPathFromArgs, getProjectMap, loadProjectMap, resolveRepoPath } from './config.mjs'
import { Graph } from './graph.mjs'
import { resolveTsImport } from './resolve.mjs'
import { isEntryPoint } from './quality.mjs'
import { clearFindings, getActiveFindings, getFindings, getSuppressedFindings } from './rules/findings.mjs'
import { buildTemplateRegistry, loadTemplatePlugins } from './templates/registry.mjs'
import { detect } from './detect.mjs'

// ── Phase functions ───────────────────────────────────────────────────────────

function phaseWalkFiles(projectMap, registry) {
  const byKind = new Map()
  for (const kind of registry.capabilities.fileKinds) {
    byKind.set(kind.id, collectFileKind(projectMap, kind))
  }

  const frontRoot = resolveRepoPath(projectMap.sourceRoots.frontend)
  const backRoot = projectMap.sourceRoots.backend ? resolveRepoPath(projectMap.sourceRoots.backend) : null
  const allFrontFiles = walk(frontRoot, file => tsExtensions.includes(path.extname(file)))
  const frontTestFiles = byKind.get('frontend-test') ?? allFrontFiles.filter(isTestFile)
  const frontFiles = byKind.get('frontend-source') ?? allFrontFiles.filter(file => !isTestFile(file))
  const allBackFiles = byKind.get('backend-source') ?? (backRoot ? walk(backRoot, file => path.extname(file) === '.cs' && !isBackTestFile(toRepoPath(file))) : [])
  const backInternalFragments = [
    projectMap.backend?.dtoPathFragment,
    projectMap.backend?.validatorPathFragment,
    projectMap.backend?.mappingPathFragment,
  ].filter(Boolean)
  const backFiles = allBackFiles.filter(file => {
    const rp = toRepoPath(file)
    return backInternalFragments.every(fragment => !rp.includes(fragment))
  })
  return { frontFiles, frontTestFiles, backFiles, allBackFiles }
}

function collectFileKind(projectMap, kind) {
  const root = projectMap.sourceRoots?.[kind.rootKey]
  if (!root) return []
  const rootPath = resolveRepoPath(root)
  const extensions = new Set(kind.extensions ?? [])
  const allFiles = walk(rootPath, file => extensions.size === 0 || extensions.has(path.extname(file)))
  return allFiles.filter(file => {
    const repoPath = toRepoPath(file)
    const test = Boolean(kind.test?.(repoPath, file))
    if (kind.testsOnly) return test
    if (kind.includeTests) return true
    return !test
  })
}

function phaseApplyRuntimeLinks(graph, projectMap) {
  if (!projectMap.project.runtimeLinks) return
  const runtimeLinksPath = resolveRepoPath(projectMap.project.runtimeLinks)
  if (!fs.existsSync(runtimeLinksPath)) return
  const parsed = JSON.parse(readText(runtimeLinksPath))
  for (const link of parsed.links ?? []) {
    const from = resolveRuntimeNode(graph, link.from)
    const to = resolveRuntimeNode(graph, link.to)
    if (!from || !to) continue
    graph.addEdge(from, to, link.type ?? 'runtime-link', {
      label: link.reason ?? link.type ?? 'runtime-link',
      confidence: link.confidence ?? 'manual',
      source: 'runtime-links'
    })
  }
}

function phaseApplyCoverage(graph, testFiles) {
  const coverageBySource = new Map()
  const testCaseCountByFile = new Map()

  for (const testFile of testFiles) {
    const covered = new Set()
    for (const candidate of sourceCandidatesForTest(testFile)) {
      if (candidate && fs.existsSync(candidate) && !isTestFile(candidate)) {
        covered.add(candidate)
      }
    }

    const content = readText(testFile)
    testCaseCountByFile.set(toRepoPath(testFile), countTestCases(content))
    const imports = content.matchAll(/(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g)
    for (const match of imports) {
      const resolved = resolveTsImport(testFile, match[1])
      if (resolved && !isTestFile(resolved)) covered.add(resolved)
    }

    for (const sourceFile of covered) {
      const sourceId = `file:${toRepoPath(sourceFile)}`
      if (!graph.hasNode(sourceId)) continue
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

function phaseCollapseInternals(graph) {
  collapseInternalComponents(graph)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveRuntimeNode(graph, value) {
  if (!value) return null
  if (value.startsWith('file:') || value.startsWith('endpoint:') || value.startsWith('table:') || value.startsWith('entity:')) return value
  const repoPath = normalizePath(value)
  if (graph.hasNode(`file:${repoPath}`)) return `file:${repoPath}`
  if (graph.hasNode(value)) return value
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

function computeOrphans(graph) {
  const incoming = new Map()
  for (const node of graph.allNodes()) incoming.set(node.id, 0)
  for (const edge of graph.allEdges()) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1)
  }

  const orphanTypes = new Set(['component', 'main-component', 'subcomponent', 'page', 'route', 'hook', 'service', 'repository', 'controller', 'query', 'command', 'handler', 'entity', 'table'])
  return graph.allNodes()
    .filter(node => orphanTypes.has(node.type))
    .filter(node => (incoming.get(node.id) ?? 0) === 0 && !isEntryPoint(node))
    .map(node => ({
      id: node.id,
      label: node.label,
      type: node.type,
      module: node.module,
      path: node.path,
      reason: 'no incoming links detected'
    }))
}

function isInternalComponentNode(node) {
  if (!node.path) return false
  if (!['component', 'main-component', 'subcomponent', 'page'].includes(node.type)) return false
  const segments = node.path.split('/')
  const dirIndex = findComponentDirIndex(segments)
  if (dirIndex < 0) return false
  return segments.slice(dirIndex + 1, -1).some(segment => segment.startsWith('_'))
}

function findInternalComponentParent(graph, node) {
  const pathParent = findPathParent(graph, node)
  if (pathParent) return pathParent

  const relatedIds = []
  for (const edge of graph.allEdges()) {
    if (edge.to === node.id) relatedIds.push(edge.from)
    if (edge.from === node.id) relatedIds.push(edge.to)
  }

  return relatedIds
    .map(id => graph.getNode(id))
    .filter(related => related && related.id !== node.id)
    .filter(related => related.module === node.module && !isInternalComponentNode(related))
    .filter(related => ['main-component', 'component', 'page', 'route'].includes(related.type))
    .sort((a, b) => parentPriority(a) - parentPriority(b))[0]?.id
    ?? findModuleParent(graph, node)
}

function findPathParent(graph, node) {
  const segments = node.path.split('/')
  const dirIndex = findComponentDirIndex(segments)
  if (dirIndex < 0) return null

  const relativeSegments = segments.slice(dirIndex + 1, -1)
  const internalIndex = relativeSegments.findIndex(segment => segment.startsWith('_'))
  if (internalIndex <= 0) return null

  for (let index = internalIndex - 1; index >= 0; index -= 1) {
    const candidateSegments = relativeSegments.slice(0, index + 1)
    const candidateBase = [...segments.slice(0, dirIndex + 1), ...candidateSegments].join('/')
    for (const extension of tsExtensions) {
      const candidateId = `file:${candidateBase}/index${extension}`
      const candidate = graph.getNode(candidateId)
      if (candidate && !isInternalComponentNode(candidate)) return candidateId
    }
  }

  return null
}

function parentPriority(node) {
  if (node.type === 'main-component') return 0
  if (node.type === 'component') return 1
  if (node.type === 'page') return 2
  if (node.type === 'route') return 3
  return 4
}

function findModuleParent(graph, node) {
  return graph.allNodes()
    .filter(candidate => candidate.id !== node.id)
    .filter(candidate => candidate.module === node.module && !isInternalComponentNode(candidate))
    .filter(candidate => ['main-component', 'component', 'page', 'route'].includes(candidate.type))
    .sort((a, b) => parentPriority(a) - parentPriority(b) || (a.path ?? '').localeCompare(b.path ?? ''))[0]?.id
}

function collapseInternalComponents(graph) {
  const internalToParent = new Map()

  for (const node of graph.allNodes()) {
    if (!isInternalComponentNode(node)) continue
    const parentId = findInternalComponentParent(graph, node)
    if (parentId) internalToParent.set(node.id, parentId)
  }

  if (internalToParent.size === 0) return

  for (const [internalId, parentId] of internalToParent) {
    const internal = graph.getNode(internalId)
    const parent = graph.getNode(parentId)
    if (!internal || !parent) continue
    addInternalComponentQuality(graph, parent, internal)
  }

  const rewiredEdges = new Map()
  for (const edge of graph.allEdges()) {
    const from = internalToParent.get(edge.from) ?? edge.from
    const to = internalToParent.get(edge.to) ?? edge.to
    if (from === to) continue
    const id = `${from}::${edge.type}::${to}`
    if (rewiredEdges.has(id)) continue
    rewiredEdges.set(id, {
      ...edge,
      id,
      from,
      to,
      source: internalToParent.has(edge.from) || internalToParent.has(edge.to)
        ? `${edge.source ?? 'scanner'}; internal-component-collapsed`
        : edge.source
    })
  }

  graph.edgeMap.clear()
  for (const [id, edge] of rewiredEdges) {
    graph.edgeMap.set(id, edge)
  }

  for (const internalId of internalToParent.keys()) {
    graph.nodeMap.delete(internalId)
  }
}

function addInternalComponentQuality(graph, parent, internal) {
  const parentQuality = parent.meta?.quality
  const internalQuality = internal.meta?.quality
  if (!internalQuality) return

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

  const scores = [parentQuality?.score, ...internalComponents.map(component => component.score)]
    .filter(score => Number.isFinite(score))
  const aggregateScore = scores.length > 0
    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    : baseQuality.score
  const worst = internalComponents[0]
  const internalSummary = `${internalComponents.length} internal component${internalComponents.length === 1 ? '' : 's'} collapsed; worst ${worst.label} ${worst.score}/10`

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

function buildGraph() {
  const projectMap = getProjectMap()
  const registry = buildTemplateRegistry(projectMap)
  const effectiveProjectMap = buildEffectiveProjectMap(projectMap, registry)
  const graph = new Graph()
  clearFindings()

  const files = phaseWalkFiles(projectMap, registry)
  const context = createScanContext(graph, projectMap, registry, files)
  phaseRunRegisteredScanners(context)
  phaseApplyRuntimeLinks(graph, projectMap)
  phaseRunRegisteredEnrichers(context)

  const nodes = graph.allNodes().sort((a, b) => a.id.localeCompare(b.id))
  const edges = graph.allEdges().sort((a, b) => a.id.localeCompare(b.id))
  const orphans = computeOrphans(graph)
  const findings = getFindings()
  const activeFindings = getActiveFindings()
  const suppressedFindings = getSuppressedFindings()

  return {
    version: 1,
    projectMap: effectiveProjectMap,
    generatedAt: new Date().toISOString(),
    repoRoot,
    stats: {
      nodes: nodes.length,
      edges: edges.length,
      orphans: orphans.length,
      frontFiles: files.frontFiles.length,
      frontTestFiles: files.frontTestFiles.length,
      backFiles: files.backFiles.length,
      hiddenDtoFiles: files.allBackFiles.length - files.backFiles.length,
      findings: activeFindings.length,
      errorFindings: activeFindings.filter(finding => finding.severity === 'error').length,
      suppressedFindings: suppressedFindings.length,
      totalFindings: findings.length
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
        : 'Static analysis is heuristic. Configure project.runtimeLinks to add runtime-only relationships.'
    ]
  }
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
  const byId = new Map(left.map(item => [item.id, item]))
  for (const item of right) byId.set(item.id, { ...(byId.get(item.id) ?? {}), ...item })
  return [...byId.values()]
}

function createScanContext(graph, projectMap, registry, files) {
  return {
    graph,
    projectMap,
    registry,
    files,
    frontEndpointIds: [],
    controllerEndpoints: [],
    controllerFiles: () => files.backFiles.filter(file => toRepoPath(file).includes(projectMap.backend?.controllerPathFragment ?? '/Controllers/')),
    applyCoverage: () => phaseApplyCoverage(graph, files.frontTestFiles),
    collapseInternalComponents: () => phaseCollapseInternals(graph)
  }
}

function phaseRunRegisteredScanners(context) {
  for (const scanner of context.registry.capabilities.scanners) {
    const result = scanner.run(context)
    if (scanner.assign) context[scanner.assign] = result ?? []
  }
}

function phaseRunRegisteredEnrichers(context) {
  for (const enricher of context.registry.capabilities.enrichers) {
    enricher.run(context)
  }
}

export function writeGraph(outputPath = resolveRepoPath(getProjectMap().project.graphOutput)) {
  const result = buildGraph()
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  return result
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const configPath = getConfigPathFromArgs()
  if (configPath) loadProjectMap(configPath)
  else loadProjectMap(detect(repoRoot))
  await loadTemplatePlugins(getProjectMap(), configPath ?? path.join(repoRoot, 'project-map.json'))
  const outArgIndex = process.argv.indexOf('--out')
  const outputPath = outArgIndex >= 0 ? path.resolve(process.argv[outArgIndex + 1]) : resolveRepoPath(getProjectMap().project.graphOutput)
  const result = writeGraph(outputPath)
  console.log(`Code map written to ${toRepoPath(outputPath)} (${result.stats.nodes} nodes, ${result.stats.edges} edges, ${result.stats.orphans} orphans).`)
}
