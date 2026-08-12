import { classifyFront, featureFromRepoPath } from '#core/classify.mjs'
import { addEndpoint } from '#core/endpoints.mjs'
import { displayLabel } from '#core/source-analysis.mjs'

export function scanFront(graph, files, projectContext, sourceDocuments) {
  const { toRepoPath } = projectContext
  const frontEndpointNodes = []
  const apiVersionPrefix = detectApiVersionPrefix(files, sourceDocuments)
  const exportedEndpointBindings = collectExportedEndpointBindings(files, toRepoPath, sourceDocuments)

  for (const file of files) {
    scanFrontFile(file, {
      graph,
      projectContext,
      sourceDocuments,
      apiVersionPrefix,
      exportedEndpointBindings,
      frontEndpointNodes
    })
  }

  return frontEndpointNodes
}

function scanFrontFile(file, context) {
  const { graph, projectContext, sourceDocuments, apiVersionPrefix, exportedEndpointBindings, frontEndpointNodes } =
    context
  const repoPath = projectContext.toRepoPath(file)
  const [type, layer] = classifyFront(repoPath, projectContext)
  const module = featureFromRepoPath(repoPath, projectContext)
  const id = `file:${repoPath}`
  const behavior = sourceDocuments.factsOf(file, 'frontendBehavior')
  const review = ['route', 'page', 'main-component'].includes(type) && behavior.reasons.length > 0

  graph.addNode(id, {
    label: displayLabel(repoPath),
    type,
    layer,
    module,
    path: repoPath,
    meta: review
      ? {
          review: {
            kind: 'logic-in-composition-layer',
            reason: `${type} contains logic or behavior: ${behavior.reasons.join(', ')}`,
            signals: behavior.reasons
          }
        }
      : {}
  })

  for (const { specifier, kind } of sourceDocuments.factsOf(file, 'moduleReferences')) {
    const resolved = sourceDocuments.resolveReference(file, specifier, projectContext)
    if (resolved) {
      const target = `file:${projectContext.toRepoPath(resolved)}`
      graph.addEdge(id, target, kind === 'dynamic' ? 'lazy-imports' : 'imports', {
        confidence: 'high',
        source: kind === 'dynamic' ? 'typescript-dynamic-import' : 'typescript-import',
        evidence: specifier
      })
    }
  }

  const importedEndpointBindings = resolveImportedEndpointBindings(
    file,
    exportedEndpointBindings,
    projectContext,
    sourceDocuments
  )
  for (const { url, method } of sourceDocuments.factsOf(file, 'frontendEndpoints', {
    bindings: importedEndpointBindings
  })) {
    const runtimeUrl = applyApiVersionPrefix(url, apiVersionPrefix)
    const endpoint = addEndpoint(graph, runtimeUrl, method, module)
    if (endpoint) {
      frontEndpointNodes.push(endpoint)
      graph.addEdge(id, endpoint, 'calls-api', {
        confidence: 'medium',
        source: 'frontend-http',
        evidence: `${method} ${runtimeUrl}`
      })
    }
  }
}

function collectExportedEndpointBindings(files, toRepoPath, sourceDocuments) {
  const byFile = new Map()
  const candidates = new Map()
  for (const file of files) {
    const bindings = sourceDocuments.factsOf(file, 'exportedEndpointBindings')
    if (bindings.size > 0) {
      byFile.set(toRepoPath(file), bindings)
    }
    for (const [name, value] of bindings) {
      const values = candidates.get(name) ?? new Set()
      values.add(value)
      candidates.set(name, values)
    }
  }
  const unique = new Map()
  for (const [name, values] of candidates) {
    if (values.size === 1) {
      unique.set(name, [...values][0])
    }
  }
  return { byFile, unique }
}

function resolveImportedEndpointBindings(file, exportedBindings, projectContext, sourceDocuments) {
  const { toRepoPath } = projectContext
  const result = new Map()
  for (const { specifier, bindings } of sourceDocuments.factsOf(file, 'endpointImports')) {
    const resolved = sourceDocuments.resolveReference(file, specifier, projectContext)
    if (!resolved) {
      continue
    }
    const exports = exportedBindings.byFile.get(toRepoPath(resolved))
    for (const { exportedName, localName } of bindings) {
      const value = exports?.get(exportedName) ?? exportedBindings.unique.get(exportedName)
      if (exportedName && localName && value) {
        result.set(localName, value)
      }
    }
  }
  return result
}

function detectApiVersionPrefix(files, sourceDocuments) {
  for (const file of files) {
    const prefix = sourceDocuments.factsOf(file, 'apiVersionPrefix')
    if (prefix) {
      return prefix
    }
  }
  return null
}

function applyApiVersionPrefix(url, prefix) {
  if (!prefix || !url.startsWith('/api/') || /^\/api\/(?:v\d+|health)(?:\/|$)/.test(url)) {
    return url
  }
  return `${prefix}${url.slice('/api/'.length)}`
}
