import { normalizeEndpoint } from '#core/endpoints.mjs'
import { typeScriptLiteralValue, typescript as ts, walkTypeScript } from '#parsers/typescript.mjs'

export function collectUrlBindings(sourceFile) {
  const bindings = new Map()
  walkTypeScript(sourceFile, (node) => {
    if ((!ts.isVariableDeclaration(node) && !ts.isPropertyDeclaration(node)) || !node.initializer) {
      return
    }
    const name = ts.isIdentifier(node.name) ? node.name.text : null
    const value = typeScriptLiteralValue(node.initializer, sourceFile)
    if (name && value?.startsWith('/api/')) {
      bindings.set(name, value)
    }
  })
  return bindings
}

export function primaryBaseUrl(bindings) {
  return (
    bindings.get('baseUrl') ??
    bindings.get('baseURL') ??
    bindings.get('BASE_URL') ??
    bindings.get('authenticationUrl') ??
    [...bindings.values()][0]
  )
}

export function resolveFrontendUrlExpression(expression, sourceFile, bindings, baseUrl) {
  if (!expression) {
    return null
  }
  const literal = typeScriptLiteralValue(expression, sourceFile)
  if (literal !== null) {
    let expanded = literal
    for (const [name, value] of bindings) {
      expanded = expanded.replaceAll('${' + name + '}', value)
      expanded = expanded.replaceAll('${this.' + name + '}', value)
    }
    return expandFrontendUrl(expanded, baseUrl)
  }

  const name = ts.isIdentifier(expression)
    ? expression.text
    : ts.isPropertyAccessExpression(expression) && expression.expression.kind === ts.SyntaxKind.ThisKeyword
      ? expression.name.text
      : null
  const bound = name ? bindings.get(name) : null
  return bound ? expandFrontendUrl(bound, baseUrl) : null
}

export function expandFrontendUrl(value, baseUrl) {
  let url = value
  if (baseUrl) {
    url = url.replaceAll('${this.baseUrl}', baseUrl)
    url = url.replaceAll('${baseUrl}', baseUrl)
    url = url.replaceAll('${baseURL}', baseUrl)
    url = url.replaceAll('${BASE_URL}', baseUrl)
    url = url.replaceAll('${authenticationUrl}', baseUrl)
    if (url === 'this.baseUrl') {
      url = baseUrl
    }
    if (['baseUrl', 'baseURL', 'BASE_URL', 'authenticationUrl'].includes(url)) {
      url = baseUrl
    }
  }
  url = url.replace(/\$\{[^}]+\}/g, '{}')
  return normalizeEndpoint(url)
}
