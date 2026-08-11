export function normalizeEndpoint(raw) {
  if (!raw || !raw.startsWith('/api')) {
    return null
  }
  return raw
    .replace(/^\/api\/api\//, '/api/')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '')
    .replace(/\/v\{version:apiVersion\}/g, '/v1')
}

function endpointId(url, method = 'ANY') {
  const canonicalUrl = url.replace(/\{[^}]+\}/g, '{}').replace(/:[^/]+/g, '{}')
  return `endpoint:${method.toUpperCase()} ${canonicalUrl}`
}

export function addEndpoint(graph, url, method = 'ANY', module = 'shared') {
  const normalized = normalizeEndpoint(url)
  if (!normalized) {
    return null
  }
  const id = endpointId(normalized, method)
  graph.addNode(id, {
    label: `${method.toUpperCase()} ${normalized}`,
    type: 'endpoint',
    layer: 'api-endpoint',
    module,
    meta: { url: normalized, method: method.toUpperCase() }
  })
  return id
}

export function endpointCompatible(frontUrl, controllerUrl) {
  const clean = (value) =>
    value
      .replace(/\$\{[^}]+\}/g, '{}')
      .replace(/\{[^}]+\}/g, '{}')
      .replace(/\/:[^/]+/g, '/{}')
      .replace(/\/+$/, '')

  const a = clean(frontUrl)
  const b = clean(controllerUrl)
  return a === b
}

export function restMethod(name) {
  if (['get', 'post', 'put', 'patch', 'delete'].includes(name)) {
    return name.toUpperCase()
  }
  return 'ANY'
}

function collectUrlBindings(sourceFile) {
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

function primaryBaseUrl(bindings) {
  return (
    bindings.get('baseUrl') ??
    bindings.get('baseURL') ??
    bindings.get('BASE_URL') ??
    bindings.get('authenticationUrl') ??
    [...bindings.values()][0]
  )
}

function resolveFrontendUrlExpression(expression, sourceFile, bindings, baseUrl) {
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

export function extractFrontendEndpoints(
  content,
  importedBindings = new Map(),
  fileName = 'source.ts',
  parsedSourceFile
) {
  const sourceFile = parsedSourceFile ?? parseTypeScript(content, fileName)
  const urlBindings = new Map(importedBindings)
  for (const [name, value] of collectUrlBindings(sourceFile)) {
    urlBindings.set(name, value)
  }
  const baseUrl = primaryBaseUrl(urlBindings)
  return defaultEndpointExtractor.extract({ sourceFile, calls: callExpressions(sourceFile), urlBindings, baseUrl })
}

export function createEndpointExtractor(extractors) {
  if (!Array.isArray(extractors) || extractors.length === 0) {
    throw new TypeError('Endpoint extractors must be a non-empty array.')
  }
  const ids = new Set()
  const ordered = extractors.map((extractor) => {
    if (!extractor || typeof extractor.id !== 'string' || typeof extractor.extract !== 'function') {
      throw new TypeError('Endpoint extractors must declare id and extract(context).')
    }
    if (ids.has(extractor.id)) {
      throw new TypeError(`Duplicate endpoint extractor id: ${extractor.id}.`)
    }
    ids.add(extractor.id)
    return Object.freeze({ id: extractor.id, extract: extractor.extract.bind(extractor) })
  })

  return Object.freeze({
    extract(context) {
      const endpoints = []
      for (const extractor of ordered) {
        const result = extractor.extract(context)
        if (!Array.isArray(result)) {
          throw new TypeError(`Endpoint extractor ${extractor.id} must return an array.`)
        }
        endpoints.push(...result)
      }
      return normalizeExtractedEndpoints(endpoints)
    }
  })
}

const defaultEndpointExtractor = createEndpointExtractor([
  { id: 'instance-methods', extract: extractInstanceMethodCalls },
  { id: 'free-functions', extract: extractFreeFunctionCalls },
  { id: 'request-objects', extract: extractRequestObjects },
  { id: 'object-arguments', extract: extractObjectArguments },
  { id: 'positional-methods', extract: extractPositionalMethods },
  { id: 'fetch', extract: extractFetchCalls }
])

function callExpressions(sourceFile) {
  const calls = []
  walkTypeScript(sourceFile, (node) => {
    if (ts.isCallExpression(node)) {
      calls.push(node)
    }
  })
  return calls
}

function extractInstanceMethodCalls({ sourceFile, calls, urlBindings, baseUrl }) {
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

function extractFreeFunctionCalls({ sourceFile, calls, urlBindings, baseUrl }) {
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

function extractRequestObjects({ sourceFile, calls, urlBindings, baseUrl }) {
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

function extractObjectArguments({ sourceFile, calls, urlBindings, baseUrl }) {
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

function extractPositionalMethods({ sourceFile, calls, urlBindings, baseUrl }) {
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

function extractFetchCalls({ sourceFile, calls, urlBindings, baseUrl }) {
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

function normalizeExtractedEndpoints(endpoints) {
  const specificMethods = new Map()
  const normalized = []
  for (const endpoint of endpoints) {
    const url = normalizeEndpoint(endpoint.url)
    if (!url) {
      continue
    }
    endpoint.url = url
    if (endpoint.method !== 'ANY') {
      if (!specificMethods.has(url)) {
        specificMethods.set(url, new Set())
      }
      specificMethods.get(url).add(endpoint.method)
    }
    normalized.push(endpoint)
  }

  const seen = new Set()
  return normalized.filter((endpoint) => {
    if (endpoint.method === 'ANY' && specificMethods.has(endpoint.url)) {
      return false
    }
    const key = `${endpoint.method}:${endpoint.url}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

export function connectEndpoints(graph, frontEndpointIds, controllerEndpoints) {
  const frontEndpoints = frontEndpointIds.map((id) => graph.getNode(id)).filter(Boolean)

  for (const front of frontEndpoints) {
    for (const controller of controllerEndpoints) {
      const methodMatches = front.meta.method === 'ANY' || controller.method === front.meta.method
      if (methodMatches && endpointCompatible(front.meta.url, controller.url)) {
        const evidence = `${controller.method} ${controller.url}`
        graph.addEdge(front.id, controller.controllerId, 'resolved-controller', {
          confidence: 'medium',
          source: 'endpoint-matcher',
          evidence
        })
        graph.addEdge(front.id, controller.id, 'matches-endpoint', {
          confidence: 'medium',
          source: 'endpoint-matcher',
          evidence
        })
      }
    }
  }
}
import {
  parseTypeScript,
  typeScriptCallName,
  typeScriptLiteralValue,
  typescript as ts,
  walkTypeScript
} from '#parsers/typescript.mjs'
