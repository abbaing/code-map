import { assertViewerOperations } from '#viewer/viewer-operation-contract.mjs'

const GRAPH_RESOURCE = '/graph.json'
const SCAN_RESOURCE = '/api/scan'
const PROJECT_MAP_RESOURCE = '/api/project-map'
const TRACE_SUBMAP_RESOURCE = '/api/submaps/from-trace'
const SUBMAPS_RESOURCE = '/api/submaps'
const SELECTION_SUBMAP_RESOURCE = '/api/submaps/from-selection'

export function createGraphGateway({ request = globalThis.fetch } = {}) {
  if (typeof request !== 'function') {
    throw new TypeError('GraphGateway request must be a function')
  }

  const send = async (resource, options) => {
    const response = await request(resource, options)
    if (!response?.ok) {
      throw new GraphGatewayError(response?.status ?? 0, await readError(response))
    }
    return response.json()
  }

  return Object.freeze({
    loadGraph() {
      return send(GRAPH_RESOURCE, { cache: 'no-store' })
    },
    scan() {
      return send(SCAN_RESOURCE, { method: 'POST' })
    },
    updateProjectMap(projectMap) {
      return send(PROJECT_MAP_RESOURCE, jsonRequest('POST', projectMap))
    },
    listSubmaps() {
      return send(SUBMAPS_RESOURCE, { cache: 'no-store' })
    },
    loadSubmap(uid) {
      return send(`${SUBMAPS_RESOURCE}/${encodeURIComponent(uid)}`, { cache: 'no-store' })
    },
    createSelectionSubmap(request) {
      return send(SELECTION_SUBMAP_RESOURCE, jsonRequest('POST', request))
    },
    createTraceSubmap(request) {
      return send(TRACE_SUBMAP_RESOURCE, jsonRequest('POST', request))
    }
  })
}

export function assertGraphGateway(gateway) {
  assertViewerOperations(gateway, 'GraphGateway', [
    'loadGraph',
    'scan',
    'updateProjectMap',
    'listSubmaps',
    'loadSubmap',
    'createSelectionSubmap',
    'createTraceSubmap'
  ])
  return gateway
}

export class GraphGatewayError extends Error {
  constructor(status, message) {
    super(message || `Graph request failed with status ${status}`)
    this.name = 'GraphGatewayError'
    this.status = status
  }
}

function jsonRequest(method, body) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
}

async function readError(response) {
  if (typeof response?.json !== 'function') {
    return ''
  }
  try {
    const body = await response.json()
    return body?.error ?? ''
  } catch {
    return ''
  }
}
