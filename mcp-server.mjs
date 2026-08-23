#!/usr/bin/env node
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { validateGraphDocument } from '#core/graph.mjs'
import { createMcpProtocol } from '#mcp/protocol.mjs'
import { serveMcpStdio } from '#mcp/stdio.mjs'
import { nodePlatform } from '#platform/node.mjs'

export async function startMcpServer({ args = [], repoRoot, platform = nodePlatform, input, output } = {}) {
  const root = repoRoot ?? platform.environment.cwd()
  const graphPath = resolveGraphPath(args, root, platform)
  const graph = validateGraphDocument(JSON.parse(platform.fileSystem.readText(graphPath)))
  return serveMcpStdio(createMcpProtocol(graph, { clock: platform.clock, hash: platform.hash }), {
    input: input ?? process.stdin,
    output: output ?? process.stdout
  })
}

export function resolveGraphPath(args, repoRoot, platform = nodePlatform) {
  const index = args.indexOf('--graph')
  const configured = index >= 0 ? args[index + 1] : platform.environment.variable('CODE_MAP_GRAPH')
  if (index >= 0 && !configured) {
    throw new TypeError('--graph requires a path.')
  }
  return path.resolve(repoRoot, configured || '.code-map/graph.json')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await startMcpServer({ args: process.argv.slice(2) })
}
