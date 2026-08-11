import path from 'node:path'
import { classifyBack, featureFromRepoPath } from '#core/classify.mjs'
import { displayLabel } from '#core/source-analysis.mjs'

export function scanBackFiles(graph, files, projectContext, session, sourceDocuments) {
  const { toRepoPath } = projectContext
  for (const file of files) {
    const repoPath = toRepoPath(file)
    const semantics = sourceDocuments.factsOf(file, 'backendSemantics')
    let [type, layer] = classifyBack(repoPath, projectContext)
    ;[type, layer] = semanticBackendRole(repoPath, type, layer)
    if (type === 'handler' && !semantics.isRequestHandler) {
      ;[type, layer] = semanticSupportRole(repoPath)
    }
    if (semantics.isDbContext) {
      ;[type, layer] = ['data-context', 'backend-repository']
    }
    if (type === 'repository' && isImplementedRepositoryInterface(file, session)) {
      ;[type, layer] = ['auxiliary', 'auxiliary']
    }
    if ((type === 'command' || type === 'query') && semantics.isMarkerInterface) {
      ;[type, layer] = ['auxiliary', 'auxiliary']
    }
    graph.addNode(`file:${repoPath}`, {
      label: displayLabel(repoPath),
      type,
      layer,
      module: featureFromRepoPath(repoPath, projectContext),
      path: repoPath
    })
  }
}

function isImplementedRepositoryInterface(file, session) {
  const stem = path.basename(file, '.cs')
  return /^I[A-Z]/.test(stem) && session.implementationsOf(stem).length > 0
}

function semanticBackendRole(repoPath, type, layer) {
  if (type === 'command' || type === 'query') {
    return [type, 'application-request']
  }
  if (type === 'handler') {
    return [type, 'application-handler']
  }
  if (type !== 'auxiliary') {
    return [type, layer]
  }
  const stem = path.basename(repoPath, '.cs')
  if (repoPath.includes('/Repositories/') || /Repository$/.test(stem)) {
    return ['repository', 'backend-repository']
  }
  if (
    /Service$/.test(stem) ||
    (!repoPath.includes('/Models/') &&
      !repoPath.includes('/Configuration/') &&
      (repoPath.includes('/Services/') ||
        /(?:Client|Provider|Resolver|Sender|Processor|Orchestrator|Selector|Adapter|Worker|Queue|Runtime|Guard|Factory)$/.test(
          stem
        )))
  ) {
    return ['service', 'backend-service']
  }
  return [type, layer]
}

function semanticSupportRole(repoPath) {
  const stem = path.basename(repoPath, '.cs')
  if (
    /(?:Service|Client|Provider|Resolver|Sender|Processor|Orchestrator|Selector|Adapter|Worker|Queue|Runtime|Guard|Factory)$/.test(
      stem
    )
  ) {
    return ['service', 'backend-service']
  }
  return ['auxiliary', 'auxiliary']
}
