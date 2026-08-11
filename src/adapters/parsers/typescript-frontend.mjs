import { extractFrontendEndpoints } from '#parsers/typescript-endpoints.mjs'
import { typeScriptCallName, typeScriptLiteralValue, typescript as ts, walkTypeScript } from '#parsers/typescript.mjs'

export const typescriptFrontendFacts = Object.freeze({
  frontendBehavior: ({ syntax }) => detectFrontBehavior(syntax),
  exportedEndpointBindings: ({ syntax }) => exportedEndpointBindings(syntax),
  endpointImports: ({ syntax }) => endpointImports(syntax),
  apiVersionPrefix: ({ syntax }) => apiVersionPrefix(syntax),
  frontendEndpoints: ({ content, file, syntax }, { bindings = new Map() } = {}) =>
    extractFrontendEndpoints(content, bindings, file, syntax)
})

function detectFrontBehavior(sourceFile) {
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

function exportedEndpointBindings(sourceFile) {
  const bindings = new Map()
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
  return bindings
}

function endpointImports(sourceFile) {
  const imports = []
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier)) {
      continue
    }
    const namedBindings = statement.importClause?.namedBindings
    if (!namedBindings || !ts.isNamedImports(namedBindings)) {
      continue
    }
    imports.push({
      specifier: statement.moduleSpecifier.text,
      bindings: namedBindings.elements.map((imported) => ({
        exportedName: imported.propertyName?.text ?? imported.name.text,
        localName: imported.name.text
      }))
    })
  }
  return imports
}

function apiVersionPrefix(sourceFile) {
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
  return prefix
}
