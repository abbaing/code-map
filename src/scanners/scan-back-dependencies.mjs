import { featureFromRepoPath } from '#core/classify.mjs'

export function scanBackDependencies(...args) {
  const [graph, files, projectContext, session, sourceDocuments] = args
  const { toRepoPath } = projectContext
  for (const file of files) {
    const repoPath = toRepoPath(file)
    const sourceId = `file:${repoPath}`
    if (!graph.hasNode(sourceId)) {
      continue
    }
    for (const dependency of sourceDocuments.factsOf(file, 'constructorDependencies')) {
      addDependency({ graph, file, repoPath, projectContext, session, dependency })
    }
  }
}

function addDependency({ graph, file, repoPath, projectContext, session, dependency }) {
  const { toRepoPath } = projectContext
  const sourceId = `file:${repoPath}`
  const target = resolveDependencyTarget(dependency.name, repoPath, projectContext, session)
  if (!target || target.file === file) {
    return
  }
  const genericEntity = dependency.typeArguments[0]
  const isRepositoryAbstraction = isRepositoryDependency(dependency.name, genericEntity)
  const useLogicalDependency = isRepositoryAbstraction || target.ambiguous
  const logicalType = dependencyRole(dependency.name)
  const compactDisplay = dependency.display.replace(/\s+/gu, '')
  const targetId = dependencyTargetId({
    isRepositoryAbstraction,
    target,
    logicalType,
    repoPath,
    projectContext,
    compactDisplay
  })
  if (useLogicalDependency) {
    graph.addNode(targetId, {
      label: dependency.display,
      type: logicalType,
      layer: logicalType === 'repository' ? 'backend-repository' : 'backend-service',
      module: featureFromRepoPath(repoPath, projectContext),
      meta: {
        backendDependency: {
          abstraction: dependency.display,
          implementation: toRepoPath(target.file),
          ...(genericEntity ? { entity: genericEntity } : {}),
          ...(target.ambiguous ? { implementationCandidates: target.alternatives } : {})
        }
      }
    })
  } else if (!graph.hasNode(targetId)) {
    return
  }
  graph.addEdge(sourceId, targetId, 'depends-on', {
    confidence: target.implementation && !target.ambiguous ? 'high' : 'medium',
    label: dependency.display,
    source: 'dotnet-constructor-dependency',
    evidence: dependency.display
  })
}

function dependencyTargetId(context) {
  const { isRepositoryAbstraction, target, logicalType, repoPath, projectContext, compactDisplay } = context
  if (!isRepositoryAbstraction && !target.ambiguous) {
    return `file:${projectContext.toRepoPath(target.file)}`
  }
  const role = isRepositoryAbstraction ? 'repository' : logicalType
  return `backend-${role}:${featureFromRepoPath(repoPath, projectContext)}:${compactDisplay}`
}

function isRepositoryDependency(name, genericEntity) {
  return Boolean(
    genericEntity && /(?:Repository|Searchable|Pageable|Includable|Aggregatable|BulkOperations|Stateful)/u.test(name)
  )
}

function dependencyRole(typeName) {
  return /(?:Repository|Searchable|Pageable|Includable|Aggregatable|BulkOperations|Stateful)/u.test(typeName)
    ? 'repository'
    : 'service'
}

function resolveDependencyTarget(typeName, sourcePath, projectContext, session) {
  const implementations = session.implementationsOf(typeName)
  const preferredImplementation = preferDependencyCandidate(implementations, sourcePath, projectContext)
  if (preferredImplementation) {
    return {
      ...preferredImplementation,
      implementation: true,
      ambiguous: implementations.length > 1,
      alternatives: implementations.map((item) => projectContext.toRepoPath(item.file)).sort()
    }
  }
  const declarations = session.declarationsNamed(typeName)
  return preferDependencyCandidate(declarations, sourcePath, projectContext)
}

function preferDependencyCandidate(candidates, sourcePath, projectContext) {
  if (!candidates.length) {
    return null
  }
  const sourceModule = featureFromRepoPath(sourcePath, projectContext)
  return (
    candidates.find(
      (candidate) => featureFromRepoPath(projectContext.toRepoPath(candidate.file), projectContext) === sourceModule
    ) ??
    candidates.find((candidate) => !projectContext.toRepoPath(candidate.file).includes('.Tests/')) ??
    candidates[0]
  )
}
