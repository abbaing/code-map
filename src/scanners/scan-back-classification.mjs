import path from 'node:path'
import { csharpName, walkCSharp } from '#parsers/csharp.mjs'
import { classifyBack, featureFromRepoPath } from '#core/classify.mjs'
import { displayLabel } from '#core/source-analysis.mjs'

export function scanBackFiles(graph, files, projectContext, session, sourceDocuments) {
  const { toRepoPath } = projectContext
  for (const file of files) {
    const repoPath = toRepoPath(file)
    let [type, layer] = classifyBack(repoPath, projectContext)
    ;[type, layer] = semanticBackendRole(repoPath, type, layer)
    if (type === 'handler' && !isRequestHandlerFile(file, sourceDocuments)) {
      ;[type, layer] = semanticSupportRole(repoPath)
    }
    if (isDbContextFile(file, sourceDocuments)) {
      ;[type, layer] = ['data-context', 'backend-repository']
    }
    if (type === 'repository' && isImplementedRepositoryInterface(file, session)) {
      ;[type, layer] = ['auxiliary', 'auxiliary']
    }
    if ((type === 'command' || type === 'query') && isMarkerInterfaceFile(file, sourceDocuments)) {
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

function isDbContextFile(file, sourceDocuments) {
  const document = sourceDocuments.requireDocumentOf(file).syntax
  if (document.declarations.some((declaration) => declaration.baseTypes.includes('DbContext'))) {
    return true
  }
  const tree = document.tree
  let found = false
  walkCSharp(tree.rootNode, (node) => {
    if (node.type === 'generic_name' && csharpName(node) === 'DbSet') {
      found = true
    }
  })
  return found
}

function isImplementedRepositoryInterface(file, session) {
  const stem = path.basename(file, '.cs')
  return /^I[A-Z]/.test(stem) && session.implementationsOf(stem).length > 0
}

function isRequestHandlerFile(file, sourceDocuments) {
  const stem = path.basename(file, '.cs')
  const tree = sourceDocuments.requireDocumentOf(file).syntax.tree
  let implementsHandler = false
  walkCSharp(tree.rootNode, (node) => {
    if (node.type === 'generic_name' && csharpName(node) === 'IRequestHandler') {
      implementsHandler = true
    }
  })
  return implementsHandler || /(?:Command|Query)Handler$/u.test(stem)
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

function isMarkerInterfaceFile(file, sourceDocuments) {
  const stem = path.basename(file, '.cs')
  const looksLikeInterface = /^I[A-Z]/.test(stem)
  if (!looksLikeInterface) {
    return false
  }
  const declarations = sourceDocuments.requireDocumentOf(file).syntax.declarations
  return declarations.some((declaration) => declaration.kind === 'interface' && declaration.name === stem)
}
