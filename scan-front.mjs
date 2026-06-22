import { toRepoPath, displayLabel, importsOf, readText, stripTsComments } from './scan-utils.mjs'
import { classifyFront, featureFromRepoPath } from './classify.mjs'
import { addEndpoint, extractFrontendEndpoints } from './endpoints.mjs'
import { resolveTsImport } from './resolve.mjs'

export function detectFrontBehavior(content) {
  const checks = [
    ['hooks', /\buse(State|Effect|Memo|Callback|Reducer|Ref|Query|Mutation|Form|Navigate|Params|SearchParams)\s*\(/u],
    ['handlers', /(?:^|\bconst\s+)\b(?:handle[A-Z]\w*|on[A-Z]\w*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[^=]+)\s*=>/um],
    ['async', /\basync\s+(?:function\s+)?\w*|\bawait\b/u],
    ['api/service/repository calls', /\b(?:apiClient|Repository|repository|Service|service)\b|\.request\s*\(|\.(?:get|post|put|patch|delete)\s*</u],
    ['state updates', /(?<![.\w])set[A-Z]\w*\s*\(/u],
    ['side effects', /\b(?:localStorage|sessionStorage|window\.|document\.|location\.)/u]
  ]

  return {
    reasons: checks
      .filter(([, pattern]) => pattern.test(content))
      .map(([label]) => label)
  }
}

export function scanFront(graph, files) {
  const frontEndpointNodes = []

  for (const file of files) {
    const repoPath = toRepoPath(file)
    const content = readText(file)
    const [type, layer] = classifyFront(repoPath)
    const module = featureFromRepoPath(repoPath)
    const id = `file:${repoPath}`
    const behavior = detectFrontBehavior(content)
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

    for (const { specifier } of importsOf(content)) {
      const resolved = resolveTsImport(file, specifier)
      if (resolved) {
        const target = `file:${toRepoPath(resolved)}`
        graph.addEdge(id, target, 'imports', { confidence: 'high' })
      }
    }

    const dynamicImports = stripTsComments(content).matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)
    for (const match of dynamicImports) {
      const resolved = resolveTsImport(file, match[1])
      if (resolved) {
        const target = `file:${toRepoPath(resolved)}`
        graph.addEdge(id, target, 'lazy-imports', { confidence: 'high' })
      }
    }

    for (const { url, method } of extractFrontendEndpoints(content)) {
      const endpoint = addEndpoint(graph, url, method, module)
      if (endpoint) {
        frontEndpointNodes.push(endpoint)
        graph.addEdge(id, endpoint, 'calls-api', { confidence: 'medium' })
      }
    }
  }

  return frontEndpointNodes
}
