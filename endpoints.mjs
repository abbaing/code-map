export function normalizeEndpoint(raw) {
  if (!raw || !raw.startsWith('/api')) return null
  return raw
    .replace(/^\/api\/api\//, '/api/')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '')
    .replace(/\/v\{version:apiVersion\}/g, '/v1')
}

function endpointId(url, method = 'ANY') {
  return `endpoint:${method.toUpperCase()} ${url}`
}

export function addEndpoint(graph, url, method = 'ANY', module = 'shared') {
  const normalized = normalizeEndpoint(url)
  if (!normalized) return null
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
  const clean = value => value
    .replace(/\$\{[^}]+\}/g, '{}')
    .replace(/\{[^}]+\}/g, '{}')
    .replace(/\/:[^/]+/g, '/{}')
    .replace(/\/+$/, '')

  const a = clean(frontUrl)
  const b = clean(controllerUrl)
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)
}

export function restMethod(name) {
  if (['get', 'post', 'put', "patch", 'delete'].includes(name)) return name.toUpperCase()
  return 'ANY'
}

function collectUrlBindings(content) {
  const bindings = new Map()
  const assignmentPattern = /(?:^|[;\n{]\s*)(?:(?:const|let|var|private|protected|public|readonly|static)\s+)*([A-Za-z_$][\w$]*)\s*(?::[^=;\n]+)?=\s*['"`](\/api\/[^'"`]+)['"`]/gm
  for (const match of content.matchAll(assignmentPattern)) {
    bindings.set(match[1], match[2])
  }
  return bindings
}

function primaryBaseUrl(bindings) {
  return bindings.get('baseUrl')
    ?? bindings.get('baseURL')
    ?? bindings.get('BASE_URL')
    ?? bindings.get('authenticationUrl')
    ?? [...bindings.values()][0]
}

function firstArgumentExpression(argument) {
  const trimmed = argument.trim()
  const match = trimmed.match(/^(`(?:[^`\\]|\\.)*`|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|this\.[A-Za-z_$][\w$]*|[A-Za-z_$][\w$]*)/)
  return match?.[1]
}

function stripQuoteExpression(expression) {
  if (!expression) return null
  const trimmed = expression.trim()
  if (trimmed.startsWith('`') && trimmed.endsWith('`')) return trimmed.slice(1, -1)
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1)
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1)
  return null
}

function bindingName(expression) {
  const trimmed = expression?.trim()
  if (!trimmed) return null
  return trimmed.startsWith('this.') ? trimmed.slice('this.'.length) : trimmed
}

function resolveFrontendUrlExpression(expression, bindings, baseUrl) {
  if (!expression) return null
  const literal = stripQuoteExpression(expression)
  if (literal !== null) {
    let expanded = literal
    for (const [name, value] of bindings) {
      expanded = expanded.replaceAll('${' + name + '}', value)
      expanded = expanded.replaceAll('${this.' + name + '}', value)
    }
    return expandFrontendUrl(expanded, baseUrl)
  }

  const bound = bindings.get(bindingName(expression))
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
    if (url === 'this.baseUrl') url = baseUrl
    if (['baseUrl', 'baseURL', 'BASE_URL', 'authenticationUrl'].includes(url)) url = baseUrl
  }
  url = url.replace(/\$\{[^}]+\}/g, '{}')
  return normalizeEndpoint(url)
}

const HTTP_CALL_PATTERN = /\b(?:apiClient|repository|Repository|\.request|\.get|\.post|\.put|\.patch|\.delete)\s*[(<]/i

export function extractFrontendEndpoints(content) {
  const endpoints = []

  const urlBindings = collectUrlBindings(content)
  const baseUrl = primaryBaseUrl(urlBindings)

  const callPattern = /this\.(get|post|put|patch|delete|requestWithFullApiResponse|request)\s*(?:<[^>]+>)?\s*\(([\s\S]{0,260}?)\)/g
  for (const match of content.matchAll(callPattern)) {
    const method = restMethod(match[1])
    const argument = match[2]
    const url = resolveFrontendUrlExpression(firstArgumentExpression(argument), urlBindings, baseUrl)
    if (url) endpoints.push({ url, method })
  }

  const freeFnPattern = /\b(get|post|put|patch|del|delete)\s*(?:<[^>]+>)?\s*\(\s*(`(?:[^`\\]|\\.)*`|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|[A-Za-z_$][\w$]*)/g
  for (const match of content.matchAll(freeFnPattern)) {
    const fnName = match[1]
    if (['get', 'post', 'put', 'patch', 'delete', 'del'].includes(fnName) === false) continue
    const method = fnName === 'del' ? 'DELETE' : fnName.toUpperCase()
    const url = resolveFrontendUrlExpression(match[2], urlBindings, baseUrl)
    if (url) endpoints.push({ url, method })
  }

  if (HTTP_CALL_PATTERN.test(content)) {
    const requestObjectPattern = /\b(?:request|apiClient\.request)\s*(?:<[^>]+>)?\s*\(([\s\S]{0,420}?)\)/g
    for (const match of content.matchAll(requestObjectPattern)) {
      const argument = match[1]
      const method = argument.match(/\bmethod:\s*['"](\w+)['"]/)?.[1]?.toUpperCase() ?? 'ANY'
      const urlExpression = argument.match(/\burl:\s*(`(?:[^`\\]|\\.)*`|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|this\.[A-Za-z_$][\w$]*|[A-Za-z_$][\w$]*)/)?.[1]
      const url = resolveFrontendUrlExpression(urlExpression, urlBindings, baseUrl)
      if (url) endpoints.push({ url, method })
    }
  }

  const specificMethods = new Map()
  const normalized = []
  for (const endpoint of endpoints) {
    const url = normalizeEndpoint(endpoint.url)
    if (!url) continue
    endpoint.url = url
    if (endpoint.method !== 'ANY') {
      if (!specificMethods.has(url)) specificMethods.set(url, new Set())
      specificMethods.get(url).add(endpoint.method)
    }
    normalized.push(endpoint)
  }

  const seen = new Set()
  return normalized.filter(endpoint => {
    if (endpoint.method === 'ANY' && specificMethods.has(endpoint.url)) return false
    const key = `${endpoint.method}:${endpoint.url}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function connectEndpoints(graph, frontEndpointIds, controllerEndpoints) {
  const frontEndpoints = frontEndpointIds
    .map(id => graph.getNode(id))
    .filter(Boolean)

  for (const front of frontEndpoints) {
    for (const controller of controllerEndpoints) {
      const methodMatches = front.meta.method === 'ANY' || controller.method === front.meta.method
      if (methodMatches && endpointCompatible(front.meta.url, controller.url)) {
        graph.addEdge(front.id, controller.controllerId, 'resolved-controller', { confidence: 'medium' })
        graph.addEdge(front.id, controller.id, 'matches-endpoint', { confidence: 'medium' })
      }
    }
  }
}
