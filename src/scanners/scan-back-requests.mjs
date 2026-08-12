import path from 'node:path'
import { featureFromRepoPath } from '#core/classify.mjs'
import { addEndpoint, normalizeEndpoint } from '#core/endpoints.mjs'
import { displayLabel } from '#core/source-analysis.mjs'
import { findBackFileByName } from '#scanners/scan-back-session.mjs'

export function scanControllers(...args) {
  const [graph, files, projectContext, session, sourceDocuments] = args
  const endpoints = []

  for (const file of files) {
    scanControllerFile(file, { graph, projectContext, session, sourceDocuments, endpoints })
  }

  return endpoints
}

function scanControllerFile(file, { graph, projectContext, session, sourceDocuments, endpoints }) {
  const { toRepoPath } = projectContext
  const repoPath = toRepoPath(file)
  const controller = sourceDocuments.factsOf(file, 'controller')
  const module = featureFromRepoPath(repoPath, projectContext)
  const id = `file:${repoPath}`
  const controllerName = controller.name ?? path.basename(file, '.cs')

  graph.addNode(id, {
    label: displayLabel(repoPath),
    type: 'controller',
    layer: 'api-controller',
    module,
    path: repoPath
  })

  const baseRoute = normalizeEndpoint(`/${controller.route ?? ''}`)
  if (!baseRoute) {
    return
  }

  for (const action of controller.actions) {
    const fullUrl = normalizeEndpoint(`${baseRoute}/${action.route}`)
    if (!fullUrl) {
      continue
    }
    const endpoint = addEndpoint(graph, fullUrl, action.method, module)
    graph.addNode(endpoint, {
      meta: {
        url: fullUrl,
        method: action.method,
        backend: { action: action.name, controller: controllerName, path: repoPath }
      }
    })
    endpoints.push({
      id: endpoint,
      url: fullUrl,
      method: action.method,
      controllerId: id,
      action: action.name
    })
    graph.addEdge(endpoint, id, 'handled-by', {
      confidence: 'high',
      source: 'dotnet-controller-route',
      evidence: `${action.method} ${fullUrl}`
    })
    for (const requestName of action.dispatchedRequests) {
      linkRequest({
        graph,
        sourceId: endpoint,
        requestName,
        module,
        confidence: 'high',
        source: `${controllerName}.${action.name}`,
        projectContext,
        session
      })
    }
  }
}

function isRequestName(name) {
  return typeof name === 'string' && (name.endsWith('Query') || name.endsWith('Command'))
}

function linkRequest({ graph, sourceId, requestName, module, confidence, source, projectContext, session }) {
  const requestPath = findBackFileByName(session, `${requestName}.cs`, module, projectContext)
  const target = requestPath ? `file:${projectContext.toRepoPath(requestPath)}` : `request:${requestName}`
  graph.addNode(target, {
    label: requestName,
    type: requestName.endsWith('Query') ? 'query' : 'command',
    layer: 'application-request',
    module,
    path: requestPath ? projectContext.toRepoPath(requestPath) : undefined
  })
  graph.addEdge(sourceId, target, 'sends', {
    confidence,
    label: source ? `dispatches in ${source}` : 'sends',
    source: 'dotnet-request-dispatch',
    evidence: requestName
  })
}

export function scanRequestDispatches(...args) {
  const [graph, files, projectContext, session, sourceDocuments] = args
  const { toRepoPath } = projectContext
  const controllerFragment = projectContext.projectMap.backend?.controllerPathFragment ?? '/Controllers/'
  for (const file of files) {
    const repoPath = toRepoPath(file)
    if (repoPath.includes(controllerFragment)) {
      continue
    }
    const id = `file:${repoPath}`
    if (!graph.hasNode(id)) {
      continue
    }
    const module = featureFromRepoPath(repoPath, projectContext)
    const ownRequest = path.basename(file, '.cs').replace(/Handler$/u, '')
    for (const requestName of sourceDocuments.factsOf(file, 'dispatchedRequests')) {
      if (!isRequestName(requestName) || requestName === ownRequest) {
        continue
      }
      linkRequest({ graph, sourceId: id, requestName, module, confidence: 'medium', projectContext, session })
    }
  }
}

export function scanRequestHandlers(graph, files, projectContext, session) {
  const { toRepoPath } = projectContext
  const handlerPathFragment = projectContext.projectMap.backend.handlerPathFragment
  for (const file of files.filter((candidate) => toRepoPath(candidate).includes(handlerPathFragment))) {
    const repoPath = toRepoPath(file)
    const handlerName = path.basename(file, '.cs')
    const requestName = handlerName.replace(/Handler$/u, '')
    const requestPath = findBackFileByName(
      session,
      `${requestName}.cs`,
      featureFromRepoPath(repoPath, projectContext),
      projectContext
    )
    if (requestPath) {
      graph.addEdge(`file:${toRepoPath(requestPath)}`, `file:${repoPath}`, 'handled-by', {
        confidence: 'high',
        source: 'dotnet-request-handler',
        evidence: requestName
      })
    }
  }
}
