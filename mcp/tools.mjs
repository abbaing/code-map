import { createSubmap } from '#submap/create.mjs'
import { findGraphNodes, graphDependencies, graphImpact, graphTrace } from '#mcp/query.mjs'

const nodeId = { type: 'string', minLength: 1, description: 'Exact graph node id.' }
const traversalProperties = {
  nodeId,
  depth: { type: 'integer', minimum: 0, maximum: 8, default: 1 },
  edgeTypes: { type: 'array', items: { type: 'string' }, uniqueItems: true }
}

export const mcpTools = Object.freeze([
  tool('find_node', 'Find nodes', 'Search graph nodes by id, label, path, type, or module.', {
    query: { type: 'string' },
    type: { type: 'string' },
    module: { type: 'string' },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
  }),
  tool(
    'dependencies',
    'Explore dependencies',
    'Traverse graph relationships from a node.',
    {
      ...traversalProperties,
      direction: { enum: ['incoming', 'outgoing', 'both'], default: 'outgoing' }
    },
    ['nodeId']
  ),
  tool('impact', 'Analyze impact', 'Find nodes that depend on the selected node.', traversalProperties, ['nodeId']),
  tool(
    'trace',
    'Trace execution',
    'Find execution paths from a node to a target or architectural boundary.',
    {
      nodeId,
      targetId: { type: 'string', minLength: 1 },
      maxDepth: { type: 'integer', minimum: 1, maximum: 12, default: 8 }
    },
    ['nodeId']
  ),
  tool(
    'create_submap',
    'Create submap',
    'Create an in-memory portable submap without writing files.',
    {
      id: { type: 'string', minLength: 1 },
      nodeIds: { type: 'array', items: nodeId, minItems: 1, uniqueItems: true },
      direction: { enum: ['incoming', 'outgoing', 'both'], default: 'both' },
      depth: { type: 'integer', minimum: 0, maximum: 8, default: 1 }
    },
    ['id', 'nodeIds']
  )
])

export function callMcpTool(graph, name, args = {}, capabilities) {
  const definition = mcpTools.find((candidate) => candidate.name === name)
  if (!definition) {
    throw new TypeError(`Unknown tool: ${name}`)
  }
  validateArguments(definition, args)
  if (name === 'find_node') {
    return findGraphNodes(graph, args)
  }
  if (name === 'dependencies') {
    return graphDependencies(graph, args)
  }
  if (name === 'impact') {
    return graphImpact(graph, args)
  }
  if (name === 'trace') {
    return graphTrace(graph, args)
  }
  return createBoundedSubmap(graph, args, capabilities)
}

function createBoundedSubmap(graph, args, capabilities) {
  const submap = createSubmap(
    graph,
    {
      id: args.id,
      selectors: { nodeIds: args.nodeIds },
      traversal: { direction: args.direction ?? 'both', maxDepth: args.depth ?? 1 },
      access: { default: 'readable' }
    },
    capabilities
  )
  if (submap.nodes.length > 1000) {
    throw new Error(`Submap contains ${submap.nodes.length} nodes; MCP responses are limited to 1000.`)
  }
  return submap
}

function validateArguments(toolDefinition, args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    throw new TypeError(`${toolDefinition.name} arguments must be an object.`)
  }
  const { properties, required, additionalProperties } = toolDefinition.inputSchema
  validateRequired(toolDefinition.name, required, args)
  validateUnknown(toolDefinition.name, properties, additionalProperties, args)
  for (const [name, value] of Object.entries(args)) {
    validateValue(name, value, properties[name])
  }
}

function validateRequired(toolName, required, args) {
  const missing = required.find((name) => args[name] === undefined)
  if (missing) {
    throw new TypeError(`${toolName} requires ${missing}.`)
  }
}

function validateUnknown(toolName, properties, additionalProperties, args) {
  const unknown = additionalProperties === false && Object.keys(args).find((name) => !Object.hasOwn(properties, name))
  if (unknown) {
    throw new TypeError(`${toolName} does not accept ${unknown}.`)
  }
}

function validateValue(name, value, schema) {
  if (schema.type === 'string') {
    return validateString(name, value, schema)
  }
  if (schema.type === 'integer') {
    return validateInteger(name, value, schema)
  }
  if (schema.type === 'array') {
    return validateArray(name, value, schema)
  }
  if (schema.enum && !schema.enum.includes(value)) {
    throw new TypeError(`${name} has an unsupported value.`)
  }
}

function validateString(name, value, schema) {
  if (typeof value !== 'string' || (schema.minLength && !value.length)) {
    throw new TypeError(`${name} must be a non-empty string.`)
  }
}

function validateInteger(name, value, schema) {
  if (!Number.isInteger(value) || value < schema.minimum || value > schema.maximum) {
    throw new TypeError(`${name} must be an integer between ${schema.minimum} and ${schema.maximum}.`)
  }
}

function validateArray(name, value, schema) {
  if (!Array.isArray(value) || (schema.minItems && value.length < schema.minItems)) {
    throw new TypeError(`${name} must be a non-empty array.`)
  }
  if (value.some((item) => schema.items.type === 'string' && typeof item !== 'string')) {
    throw new TypeError(`${name} items must be strings.`)
  }
}

function tool(name, title, description, properties, required = []) {
  return Object.freeze({
    name,
    title,
    description,
    inputSchema: { type: 'object', properties, required, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  })
}
