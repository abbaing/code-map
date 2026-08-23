import { designStatus } from '#architecture/component-model.mjs'

export const mcpComponents = [
  {
    id: 'mcp-query',
    responsibility: 'Query graph nodes, dependencies, impact, and bounded execution paths.',
    role: 'core',
    files: ['mcp/query.mjs'],
    contracts: ['GraphDocument', 'GraphQuery'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep graph queries deterministic, bounded, and independent from MCP transport details.'
  },
  {
    id: 'mcp-tools',
    responsibility: 'Expose validated code-map graph operations as MCP tools.',
    role: 'adapter',
    files: ['mcp/tools.mjs'],
    contracts: ['McpTool'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Map stable tool schemas to pure graph and submap operations without filesystem writes.'
  },
  {
    id: 'mcp-protocol',
    responsibility: 'Dispatch modern and legacy MCP JSON-RPC requests.',
    role: 'adapter',
    files: ['mcp/protocol.mjs', 'mcp/stdio.mjs'],
    contracts: ['JSON-RPC', 'MCP'],
    compositionRoot: false,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep protocol framing separate from graph operations and support both MCP protocol eras.'
  },
  {
    id: 'mcp-server',
    responsibility: 'Compose graph loading, MCP protocol handling, and stdio transport.',
    role: 'composition-root',
    files: ['mcp-server.mjs'],
    contracts: ['MCP', 'GraphDocument'],
    compositionRoot: true,
    design: designStatus('pass', 'pass', 'pass', 'pass', 'pass'),
    decision: 'Keep the executable local, read-only, and free of stdout diagnostics outside protocol messages.'
  }
]
