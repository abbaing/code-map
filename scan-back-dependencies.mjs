import { featureFromRepoPath } from './classify.mjs'
import { escapeRegExp, stripCSharpComments, stripCSharpStringLiterals } from './source-analysis.mjs'

export function scanBackDependencies(graph, files, projectContext, session, sourceReader) {
  const { toRepoPath } = projectContext
  for (const file of files) {
    const repoPath = toRepoPath(file)
    const sourceId = `file:${repoPath}`
    if (!graph.hasNode(sourceId)) {
      continue
    }
    const content = stripCSharpComments(stripCSharpStringLiterals(sourceReader.readText(file)))
    const declaration = csharpTypeDeclarations(content).find((item) => item.kind === 'class')
    if (!declaration) {
      continue
    }

    for (const dependency of collectConstructorDependencies(content, declaration.name)) {
      const target = resolveDependencyTarget(dependency.name, repoPath, projectContext, session)
      if (!target || target.file === file) {
        continue
      }
      const genericEntity = dependency.display.match(/<\s*([A-Z]\w*)\s*>/)?.[1]
      const isRepositoryAbstraction =
        genericEntity &&
        /(?:Repository|Searchable|Pageable|Includable|Aggregatable|BulkOperations|Stateful)/.test(dependency.name)
      const useLogicalDependency = isRepositoryAbstraction || target.ambiguous
      const logicalType = dependencyRole(dependency.name)
      const targetId = isRepositoryAbstraction
        ? `backend-repository:${featureFromRepoPath(repoPath, projectContext)}:${dependency.display.replace(/\s+/g, '')}`
        : target.ambiguous
          ? `backend-${logicalType}:${featureFromRepoPath(repoPath, projectContext)}:${dependency.display.replace(/\s+/g, '')}`
          : `file:${toRepoPath(target.file)}`
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
        continue
      }
      graph.addEdge(sourceId, targetId, 'depends-on', {
        confidence: target.implementation && !target.ambiguous ? 'high' : 'medium',
        label: dependency.display
      })
    }
  }
}

function dependencyRole(typeName) {
  return /(?:Repository|Searchable|Pageable|Includable|Aggregatable|BulkOperations|Stateful)/.test(typeName)
    ? 'repository'
    : 'service'
}

function collectConstructorDependencies(content, className) {
  const blocks = []
  const primary = content.match(
    new RegExp(`\\bclass\\s+${escapeRegExp(className)}(?:\\s*<[^>{]+>)?\\s*\\(([\\s\\S]{0,3000}?)\\)\\s*(?::|\\{)`)
  )
  if (primary) {
    blocks.push(primary[1])
  }
  const constructors = new RegExp(`\\b${escapeRegExp(className)}\\s*\\(([\\s\\S]{0,3000}?)\\)\\s*(?::[^\\{]+)?\\{`, 'g')
  for (const match of content.matchAll(constructors)) {
    blocks.push(match[1])
  }

  const dependencies = new Map()
  for (const block of blocks) {
    for (const match of block.matchAll(/(?:^|,)\s*([A-ZI][\w.]*(?:\s*<[^>]+>)?)\s+\w+/gm)) {
      const display = match[1].replace(/\s+/g, ' ').trim()
      const name = display.match(/(?:^|\.)([A-ZI]\w*)\s*(?:<|$)/)?.[1]
      if (name) {
        dependencies.set(`${name}:${display}`, { name, display })
      }
    }
  }
  return [...dependencies.values()]
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

export function csharpTypeDeclarations(content) {
  const declarations = []
  const pattern = /\b(class|interface)\s+(\w+)(?:\s*<[^>{]+>)?(?:\s*\([^)]*\))?\s*(?::\s*([^{]+))?\s*\{/g
  for (const match of content.matchAll(pattern)) {
    const baseTypes = (match[3] ?? '')
      .split(',')
      .map((value) => value.trim().match(/(?:^|\.)([A-ZI]\w*)\s*(?:<|$)/)?.[1])
      .filter(Boolean)
    declarations.push({ kind: match[1], name: match[2], baseTypes })
  }
  return declarations
}
