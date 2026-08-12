import path from 'node:path'

export function applyCoverage(graph, testFiles, projectContext, sourceDocuments) {
  const { toRepoPath } = projectContext
  const { fileSystem } = projectContext.platform
  const coverageBySource = new Map()
  const testCaseCountByFile = new Map()

  for (const testFile of testFiles) {
    indexTestCoverage(testFile, { graph, projectContext, sourceDocuments, fileSystem, toRepoPath }, coverageBySource)
    testCaseCountByFile.set(toRepoPath(testFile), sourceDocuments.factsOf(testFile, 'testCaseCount') ?? 0)
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

function indexTestCoverage(testFile, context, coverageBySource) {
  const { graph, projectContext, sourceDocuments, fileSystem, toRepoPath } = context
  const covered = new Set(
    sourceCandidatesForTest(testFile, sourceDocuments.extensionsFor(testFile)).filter(
      (candidate) => candidate && fileSystem.exists(candidate) && !sourceDocuments.isTest(candidate)
    )
  )
  for (const { specifier } of sourceDocuments.factsOf(testFile, 'moduleReferences') ?? []) {
    const resolved = sourceDocuments.resolveReference(testFile, specifier, projectContext)
    if (resolved && !sourceDocuments.isTest(resolved)) {
      covered.add(resolved)
    }
  }
  for (const sourceFile of covered) {
    const sourceId = `file:${toRepoPath(sourceFile)}`
    if (graph.hasNode(sourceId)) {
      const current = coverageBySource.get(sourceId) ?? []
      current.push(toRepoPath(testFile))
      coverageBySource.set(sourceId, current)
    }
  }
}

function sourceCandidatesForTest(testFile, extensions) {
  const ext = path.extname(testFile)
  const baseWithoutExt = testFile.slice(0, -ext.length)
  const withoutTestSuffix = baseWithoutExt.replace(/\.(spec|test)$/u, '')
  const candidates = []

  for (const sourceExt of extensions) {
    candidates.push(`${withoutTestSuffix}${sourceExt}`)
  }

  const basename = path.basename(withoutTestSuffix)
  if (basename === 'index') {
    for (const sourceExt of extensions) {
      candidates.push(path.join(path.dirname(testFile), `index${sourceExt}`))
    }
  }

  return candidates
}
