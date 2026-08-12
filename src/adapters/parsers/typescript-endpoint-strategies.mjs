import { restMethod } from '#core/endpoints.mjs'
import { resolveFrontendUrlExpression } from '#parsers/typescript-endpoint-urls.mjs'
import { typeScriptCallName, typeScriptLiteralValue, typescript as ts } from '#parsers/typescript.mjs'

export function extractInstanceMethodCalls({ sourceFile, calls, urlBindings, baseUrl }) {
  const endpoints = []
  for (const call of calls) {
    if (
      !ts.isPropertyAccessExpression(call.expression) ||
      call.expression.expression.kind !== ts.SyntaxKind.ThisKeyword
    ) {
      continue
    }
    const name = call.expression.name.text
    if (!['get', 'post', 'put', 'patch', 'delete', 'requestWithFullApiResponse', 'request'].includes(name)) {
      continue
    }
    const method = restMethod(name)
    const url = resolveFrontendUrlExpression(call.arguments[0], sourceFile, urlBindings, baseUrl)
    if (url) {
      endpoints.push({ url, method })
    }
  }
  return endpoints
}

export function extractFreeFunctionCalls({ sourceFile, calls, urlBindings, baseUrl }) {
  const endpoints = []
  for (const call of calls) {
    if (!ts.isIdentifier(call.expression)) {
      continue
    }
    const fnName = call.expression.text
    if (!['get', 'post', 'put', 'patch', 'delete', 'del'].includes(fnName)) {
      continue
    }
    const method = fnName === 'del' ? 'DELETE' : fnName.toUpperCase()
    const url = resolveFrontendUrlExpression(call.arguments[0], sourceFile, urlBindings, baseUrl)
    if (url) {
      endpoints.push({ url, method })
    }
  }
  return endpoints
}

function objectProperty(object, name) {
  const property = object.properties.find(
    (candidate) =>
      ts.isPropertyAssignment(candidate) &&
      (ts.isIdentifier(candidate.name) || ts.isStringLiteralLike(candidate.name)) &&
      candidate.name.text === name
  )
  return property?.initializer ?? null
}

export function extractRequestObjects({ sourceFile, calls, urlBindings, baseUrl }) {
  const endpoints = []
  for (const call of calls) {
    if (
      typeScriptCallName(call.expression) !== 'request' ||
      !call.arguments[0] ||
      !ts.isObjectLiteralExpression(call.arguments[0])
    ) {
      continue
    }
    const method =
      typeScriptLiteralValue(objectProperty(call.arguments[0], 'method'), sourceFile)?.toUpperCase() ?? 'ANY'
    const url = resolveFrontendUrlExpression(objectProperty(call.arguments[0], 'url'), sourceFile, urlBindings, baseUrl)
    if (url) {
      endpoints.push({ url, method })
    }
  }
  return endpoints
}

export function extractObjectArguments({ sourceFile, calls, urlBindings, baseUrl }) {
  const endpoints = []
  for (const call of calls) {
    const object = call.arguments[0]
    if (!object || !ts.isObjectLiteralExpression(object)) {
      continue
    }
    const method = typeScriptLiteralValue(objectProperty(object, 'method'), sourceFile)?.toUpperCase()
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      continue
    }
    const url = resolveFrontendUrlExpression(objectProperty(object, 'url'), sourceFile, urlBindings, baseUrl)
    if (url) {
      endpoints.push({ url, method })
    }
  }
  return endpoints
}

export function extractPositionalMethods({ sourceFile, calls, urlBindings, baseUrl }) {
  const endpoints = []
  for (const call of calls) {
    const method = typeScriptLiteralValue(call.arguments[0], sourceFile)?.toUpperCase()
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      continue
    }
    const url = resolveFrontendUrlExpression(call.arguments[1], sourceFile, urlBindings, baseUrl)
    if (url) {
      endpoints.push({ url, method })
    }
  }
  return endpoints
}

export function extractFetchCalls({ sourceFile, calls, urlBindings, baseUrl }) {
  const endpoints = []
  for (const call of calls) {
    if (!ts.isIdentifier(call.expression) || call.expression.text !== 'fetch') {
      continue
    }
    const url = resolveFrontendUrlExpression(call.arguments[0], sourceFile, urlBindings, baseUrl)
    if (!url) {
      continue
    }
    const options = call.arguments[1]
    const method =
      options && ts.isObjectLiteralExpression(options)
        ? (typeScriptLiteralValue(objectProperty(options, 'method'), sourceFile)?.toUpperCase() ?? 'GET')
        : 'GET'
    endpoints.push({ url, method })
  }
  return endpoints
}
