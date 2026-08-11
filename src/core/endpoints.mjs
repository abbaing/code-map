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

  return clean(frontUrl) === clean(controllerUrl)
}

export function restMethod(name) {
  return ['get', 'post', 'put', 'patch', 'delete'].includes(name) ? name.toUpperCase() : 'ANY'
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

export function normalizeExtractedEndpoints(endpoints) {
  const specificMethods = new Map()
  const normalized = []
  for (const endpoint of endpoints) {
    const url = normalizeEndpoint(endpoint.url)
    if (!url) {
      continue
    }
    const normalizedEndpoint = { ...endpoint, url }
    if (endpoint.method !== 'ANY') {
      if (!specificMethods.has(url)) {
        specificMethods.set(url, new Set())
      }
      specificMethods.get(url).add(endpoint.method)
    }
    normalized.push(normalizedEndpoint)
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
