import { callMcpTool, mcpTools } from '#mcp/tools.mjs'

export const MCP_PROTOCOL_VERSIONS = Object.freeze(['2026-07-28', '2025-11-25'])
const serverInfo = Object.freeze({ name: '@abbaing/code-map', version: '0.1.0' })

export function createMcpProtocol(graph, capabilities) {
  const session = { legacyInitialized: false }
  return Object.freeze({
    handle(message) {
      if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
        return failure(message?.id ?? null, -32600, 'Invalid JSON-RPC request')
      }
      if (!Object.hasOwn(message, 'id')) {
        return null
      }
      return handleRequest(graph, message, capabilities, session)
    }
  })
}

function handleRequest(graph, message, capabilities, session) {
  try {
    if (message.method === 'initialize') {
      session.legacyInitialized = true
    }
    if (message.method !== 'initialize' && !session.legacyInitialized) {
      validateModernVersion(message)
    }
    return success(message.id, dispatch(graph, message, capabilities))
  } catch (error) {
    return failure(message.id, error.code ?? errorCode(error), error.message, error.data)
  }
}

function errorCode(error) {
  return error instanceof TypeError ? -32602 : -32603
}

function dispatch(graph, message, capabilities) {
  const handler = requestHandlers[message.method]
  if (!handler) {
    throw new McpProtocolError(-32601, `Unknown method: ${message.method}`)
  }
  return handler(graph, message, capabilities)
}

const requestHandlers = Object.freeze({
  'server/discover': () => ({
    resultType: 'complete',
    supportedVersions: MCP_PROTOCOL_VERSIONS,
    capabilities: { tools: {} },
    _meta: { 'io.modelcontextprotocol/serverInfo': serverInfo },
    instructions: 'Query the local code-map graph before reading broad areas of the repository.',
    ttlMs: 300000,
    cacheScope: 'private'
  }),
  initialize: (_graph, message) => initialize(message),
  ping: (_graph, message) => (isModern(message) ? { resultType: 'complete' } : {}),
  'tools/list': (_graph, message) =>
    isModern(message) ? { resultType: 'complete', tools: mcpTools } : { tools: mcpTools },
  'tools/call': (graph, message, capabilities) => callTool(graph, message, capabilities)
})

function initialize(message) {
  const requested = message.params?.protocolVersion
  const protocolVersion = MCP_PROTOCOL_VERSIONS.includes(requested) ? requested : '2025-11-25'
  return { protocolVersion, capabilities: { tools: {} }, serverInfo }
}

function callTool(graph, message, capabilities) {
  try {
    const result = callMcpTool(graph, message.params?.name, message.params?.arguments, capabilities)
    return toolResult(result, false, isModern(message))
  } catch (error) {
    if (error instanceof TypeError) {
      throw error
    }
    return toolResult({ error: error.message }, true, isModern(message))
  }
}

function isModern(message) {
  return message.params?._meta?.['io.modelcontextprotocol/protocolVersion'] === '2026-07-28'
}

function toolResult(result, isError, modern) {
  const value = {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    structuredContent: { result },
    isError
  }
  return modern ? { resultType: 'complete', ...value } : value
}

function validateModernVersion(message) {
  const requested = message.params?._meta?.['io.modelcontextprotocol/protocolVersion']
  if (!requested) {
    throw new McpProtocolError(-32600, 'Modern MCP requests require protocol version metadata.')
  }
  if (requested !== MCP_PROTOCOL_VERSIONS[0]) {
    throw new McpProtocolError(-32022, 'Unsupported protocol version', {
      supported: MCP_PROTOCOL_VERSIONS,
      requested
    })
  }
}

class McpProtocolError extends Error {
  constructor(code, message, data) {
    super(message)
    this.code = code
    this.data = data
  }
}

function success(id, result) {
  return { jsonrpc: '2.0', id, result }
}

function failure(id, code, message, data) {
  return { jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } }
}
