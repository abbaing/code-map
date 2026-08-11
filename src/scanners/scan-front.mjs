import {
  displayLabel,
  moduleReferencesOf,
  typeScriptCallName,
  typeScriptLiteralValue,
  typescript as ts,
  walkTypeScript
} from '#parsers/typescript.mjs'
import { classifyFront, featureFromRepoPath } from '#core/classify.mjs'
import { addEndpoint } from '#core/endpoints.mjs'
import { extractFrontendEndpoints } from '#parsers/typescript-endpoints.mjs'
import { resolveTsImport } from '#parsers/typescript-resolver.mjs'

export function detectFrontBehavior(content, parsedSourceFile) {
  const sourceFile = parsedSourceFile
  const reasons = new Set()
  const hookNames = new Set([
    'useState',
    'useEffect',
    'useMemo',
    'useCallback',
    'useReducer',
    'useRef',
    'useQuery',
    'useMutation',
    'useForm',
    'useNavigate',
    'useParams',
    'useSearchParams'
  ])
  walkTypeScript(sourceFile, (node) => {
    if (ts.isCallExpression(node)) {
      const name = typeScriptCallName(node.expression)
      if (hookNames.has(name)) {
        reasons.add('hooks')
      }
      if (name && /^set[A-Z]/u.test(name)) {
        reasons.add('state updates')
      }
      if (['request', 'get', 'post', 'put', 'patch', 'delete'].includes(name)) {
        reasons.add('api/service/repository calls')
      }
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const name = node.name.text
      if (
        (/^handle[A-Z]/u.test(name) || /^on[A-Z]/u.test(name)) &&
        node.initializer &&
        ts.isArrowFunction(node.initializer)
      ) {
        reasons.add('handlers')
      }
    }
    if (
      ts.isAwaitExpression(node) ||
      node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)
    ) {
      reasons.add('async')
    }
    if (ts.isIdentifier(node)) {
      if (/^(?:apiClient|.*(?:Repository|repository|Service|service))$/u.test(node.text)) {
        reasons.add('api/service/repository calls')
      }
      if (['localStorage', 'sessionStorage', 'window', 'document', 'location'].includes(node.text)) {
        reasons.add('side effects')
      }
    }
  })
  const order = ['hooks', 'handlers', 'async', 'api/service/repository calls', 'state updates', 'side effects']
  return { reasons: order.filter((reason) => reasons.has(reason)) }
}

export function scanFront(graph, files, projectContext, sourceDocuments) {
  const { toRepoPath } = projectContext
  const frontEndpointNodes = []
  const sources = new Map(
    files.map((file) => {
      const document = sourceDocuments.documentOf(file)
      return [file, { content: document.content, sourceFile: document.syntax }]
    })
  )
  const apiVersionPrefix = detectApiVersionPrefix(files, sources)
  const exportedEndpointBindings = collectExportedEndpointBindings(files, toRepoPath, sources)

  for (const file of files) {
    const repoPath = toRepoPath(file)
    const { content, sourceFile } = sources.get(file)
    const [type, layer] = classifyFront(repoPath, projectContext)
    const module = featureFromRepoPath(repoPath, projectContext)
    const id = `file:${repoPath}`
    const behavior = detectFrontBehavior(content, sourceFile)
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

    for (const { specifier, kind } of moduleReferencesOf(content, file, sourceFile)) {
      const resolved = resolveTsImport(file, specifier, projectContext)
      if (resolved) {
        const target = `file:${toRepoPath(resolved)}`
        graph.addEdge(id, target, kind === 'dynamic' ? 'lazy-imports' : 'imports', {
          confidence: 'high',
          source: kind === 'dynamic' ? 'typescript-dynamic-import' : 'typescript-import',
          evidence: specifier
        })
      }
    }

    const importedEndpointBindings = resolveImportedEndpointBindings(
      file,
      content,
      exportedEndpointBindings,
      projectContext,
      sourceFile
    )
    for (const { url, method } of extractFrontendEndpoints(content, importedEndpointBindings, file, sourceFile)) {
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

  return frontEndpointNodes
}

function collectExportedEndpointBindings(files, toRepoPath, sources) {
  const byFile = new Map()
  const candidates = new Map()
  for (const file of files) {
    const bindings = new Map()
    const { sourceFile } = sources.get(file)
    for (const statement of sourceFile.statements) {
      if (
        !ts.isVariableStatement(statement) ||
        !statement.modifiers?.some((item) => item.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        continue
      }
      for (const declaration of statement.declarationList.declarations) {
        const name = ts.isIdentifier(declaration.name) ? declaration.name.text : null
        const value = typeScriptLiteralValue(declaration.initializer, sourceFile)
        if (name && value?.startsWith('/api')) {
          bindings.set(name, value)
        }
      }
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

function resolveImportedEndpointBindings(file, content, exportedBindings, projectContext, parsedSourceFile) {
  const { toRepoPath } = projectContext
  const result = new Map()
  const sourceFile = parsedSourceFile
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier)) {
      continue
    }
    const namedBindings = statement.importClause?.namedBindings
    if (!namedBindings || !ts.isNamedImports(namedBindings)) {
      continue
    }
    const resolved = resolveTsImport(file, statement.moduleSpecifier.text, projectContext)
    if (!resolved) {
      continue
    }
    const exports = exportedBindings.byFile.get(toRepoPath(resolved))
    for (const imported of namedBindings.elements) {
      const exportedName = imported.propertyName?.text ?? imported.name.text
      const localName = imported.name.text
      const value = exports?.get(exportedName) ?? exportedBindings.unique.get(exportedName)
      if (exportedName && localName && value) {
        result.set(localName, value)
      }
    }
  }
  return result
}

function detectApiVersionPrefix(files, sources) {
  for (const file of files) {
    const { sourceFile } = sources.get(file)
    let prefix = null
    walkTypeScript(sourceFile, (node) => {
      if (prefix || !ts.isCallExpression(node) || typeScriptCallName(node.expression) !== 'replace') {
        return
      }
      const pattern = node.arguments[0]
      const replacement = typeScriptLiteralValue(node.arguments[1], sourceFile)
      if (
        pattern?.kind === ts.SyntaxKind.RegularExpressionLiteral &&
        pattern.text.includes('api') &&
        /^\/api\/v\d+\/$/u.test(replacement ?? '')
      ) {
        prefix = replacement
      }
    })
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
