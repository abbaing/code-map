import { displayLabel, importsOf, readText, stripTsComments } from './scan-utils.mjs'
import { classifyFront, featureFromRepoPath } from './classify.mjs'
import { addEndpoint, extractFrontendEndpoints } from './endpoints.mjs'
import { resolveTsImport } from './resolve.mjs'

export function detectFrontBehavior(content) {
  const checks = [
    ['hooks', /\buse(State|Effect|Memo|Callback|Reducer|Ref|Query|Mutation|Form|Navigate|Params|SearchParams)\s*\(/u],
    ['handlers', /(?:^|\bconst\s+)\b(?:handle[A-Z]\w*|on[A-Z]\w*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[^=]+)\s*=>/mu],
    ['async', /\basync\s+(?:function\s+)?\w*|\bawait\b/u],
    [
      'api/service/repository calls',
      /\b(?:apiClient|Repository|repository|Service|service)\b|\.request\s*\(|\.(?:get|post|put|patch|delete)\s*</u
    ],
    ['state updates', /(?<![.\w])set[A-Z]\w*\s*\(/u],
    ['side effects', /\b(?:localStorage|sessionStorage|window\.|document\.|location\.)/u]
  ]

  return {
    reasons: checks.filter(([, pattern]) => pattern.test(content)).map(([label]) => label)
  }
}

export function scanFront(graph, files, projectContext) {
  const { toRepoPath } = projectContext
  const frontEndpointNodes = []
  const apiVersionPrefix = detectApiVersionPrefix(files)
  const exportedEndpointBindings = collectExportedEndpointBindings(files, toRepoPath)

  for (const file of files) {
    const repoPath = toRepoPath(file)
    const content = readText(file)
    const [type, layer] = classifyFront(repoPath, projectContext)
    const module = featureFromRepoPath(repoPath, projectContext)
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
      const resolved = resolveTsImport(file, specifier, projectContext)
      if (resolved) {
        const target = `file:${toRepoPath(resolved)}`
        graph.addEdge(id, target, 'imports', { confidence: 'high' })
      }
    }

    const dynamicImports = stripTsComments(content).matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)
    for (const match of dynamicImports) {
      const resolved = resolveTsImport(file, match[1], projectContext)
      if (resolved) {
        const target = `file:${toRepoPath(resolved)}`
        graph.addEdge(id, target, 'lazy-imports', { confidence: 'high' })
      }
    }

    const importedEndpointBindings = resolveImportedEndpointBindings(
      file,
      content,
      exportedEndpointBindings,
      projectContext
    )
    for (const { url, method } of extractFrontendEndpoints(content, importedEndpointBindings)) {
      const runtimeUrl = applyApiVersionPrefix(url, apiVersionPrefix)
      const endpoint = addEndpoint(graph, runtimeUrl, method, module)
      if (endpoint) {
        frontEndpointNodes.push(endpoint)
        graph.addEdge(id, endpoint, 'calls-api', { confidence: 'medium' })
      }
    }
  }

  return frontEndpointNodes
}

function collectExportedEndpointBindings(files, toRepoPath) {
  const byFile = new Map()
  const candidates = new Map()
  const pattern = /\bexport\s+const\s+([A-Za-z_$][\w$]*)\s*(?::[^=;\n]+)?=\s*['"`]((?:\/api)(?:[^'"`\\]|\\.)*)['"`]/g
  for (const file of files) {
    const bindings = new Map()
    for (const match of readText(file).matchAll(pattern)) {
      bindings.set(match[1], match[2])
    }
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

function resolveImportedEndpointBindings(file, content, exportedBindings, projectContext) {
  const { toRepoPath } = projectContext
  const result = new Map()
  const importPattern = /\bimport\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]/g
  for (const match of content.matchAll(importPattern)) {
    const resolved = resolveTsImport(file, match[2], projectContext)
    if (!resolved) {
      continue
    }
    const exports = exportedBindings.byFile.get(toRepoPath(resolved))
    for (const imported of match[1].split(',')) {
      const parts = imported
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
      const exportedName = parts[0]?.trim()
      const localName = parts[1]?.trim() || exportedName
      const value = exports?.get(exportedName) ?? exportedBindings.unique.get(exportedName)
      if (exportedName && localName && value) {
        result.set(localName, value)
      }
    }
  }
  return result
}

function detectApiVersionPrefix(files) {
  for (const file of files) {
    const content = readText(file)
    const match = content.match(/\.replace\([\s\S]{0,180}?['"](\/api\/v\d+\/)['"]\)/)
    if (match && /\^\\?\/api\\?\//.test(match[0])) {
      return match[1]
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
