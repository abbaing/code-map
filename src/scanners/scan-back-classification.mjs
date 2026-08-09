import path from 'node:path'
import { classifyBack, featureFromRepoPath } from '#core/classify.mjs'
import { displayLabel, escapeRegExp, stripCSharpComments, stripCSharpStringLiterals } from '#core/source-analysis.mjs'

export function scanBackFiles(graph, files, projectContext, session, sourceReader) {
  const { toRepoPath } = projectContext
  for (const file of files) {
    const repoPath = toRepoPath(file)
    let [type, layer] = classifyBack(repoPath, projectContext)
    ;[type, layer] = semanticBackendRole(repoPath, type, layer)
    if (type === 'handler' && !isRequestHandlerFile(file, sourceReader)) {
      ;[type, layer] = semanticSupportRole(repoPath)
    }
    if (isDbContextFile(file, sourceReader)) {
      ;[type, layer] = ['data-context', 'backend-repository']
    }
    if (type === 'repository' && isImplementedRepositoryInterface(file, session)) {
      ;[type, layer] = ['auxiliary', 'auxiliary']
    }
    if ((type === 'command' || type === 'query') && isMarkerInterfaceFile(file, sourceReader)) {
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

function isDbContextFile(file, sourceReader) {
  const content = stripCSharpComments(stripCSharpStringLiterals(sourceReader.readText(file)))
  return (
    /\bclass\s+\w+\s*(?:\([^)]*\))?\s*:\s*DbContext\b/.test(content) || /\bDbSet<\w+>\s+\w+\s*(?:\{|=>)/.test(content)
  )
}

function isImplementedRepositoryInterface(file, session) {
  const stem = path.basename(file, '.cs')
  return /^I[A-Z]/.test(stem) && session.implementationsOf(stem).length > 0
}

function isRequestHandlerFile(file, sourceReader) {
  const stem = path.basename(file, '.cs')
  const content = stripCSharpComments(stripCSharpStringLiterals(sourceReader.readText(file)))
  return /\bIRequestHandler\s*</.test(content) || /(?:Command|Query)Handler$/.test(stem)
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

function isMarkerInterfaceFile(file, sourceReader) {
  const stem = path.basename(file, '.cs')
  const looksLikeInterface = /^I[A-Z]/.test(stem)
  if (!looksLikeInterface) {
    return false
  }
  return new RegExp(`\\binterface\\s+${escapeRegExp(stem)}\\b`).test(sourceReader.readText(file))
}
