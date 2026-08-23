import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { performance } from 'node:perf_hooks'
import { createNodePlatform } from '#platform/node.mjs'
import { runNodeScan } from '#node/scan-node.mjs'
import { createSubmap, compareSubmaps } from '#submap/index.mjs'
import { layoutLayeredNodes } from '#viewer/viewer-layout-layered.js'
import { layerOrder, state } from '#viewer/viewer-state.js'
import { BENCHMARK_SIZES, createBenchmarkProject } from '#tests/benchmarks/fixture.mjs'

const sizes = selectedSizes(process.argv.slice(2), process.env.CODE_MAP_BENCHMARK_SIZES)
const jsonOnly = process.argv.includes('--json')
const results = []

for (const fileCount of sizes) {
  results.push(await benchmarkSize(fileCount))
}

if (jsonOnly) {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), node: process.version, results }, null, 2))
} else {
  console.table(results)
  console.log('Use --all for the 1k/5k/20k suite or CODE_MAP_BENCHMARK_SIZES=1000,5000 for custom sizes.')
}

async function benchmarkSize(fileCount) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `code-map-benchmark-${fileCount}-`))
  try {
    createBenchmarkProject(root, fileCount)
    const beforeHeap = process.memoryUsage().heapUsed
    const scan = await measure(() => runNodeScan({ platform: benchmarkPlatform(root) }))
    const graphPath = path.join(root, '.code-map', 'graph.json')
    const graphText = fs.readFileSync(graphPath, 'utf8')
    const graph = JSON.parse(graphText)
    state.graph = graph
    layerOrder.splice(0, layerOrder.length, ...new Set(graph.nodes.map((node) => node.layer).filter(Boolean)))
    const layout = await measure(() => layoutLayeredNodes(graph.nodes, 1440, 900))
    const submap = await measure(() => benchmarkSubmaps(graph))
    return {
      files: fileCount,
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      scanMs: round(scan.elapsed),
      layoutMs: round(layout.elapsed),
      submapMs: round(submap.elapsed),
      heapDeltaMiB: round((process.memoryUsage().heapUsed - beforeHeap) / 1024 / 1024),
      graphMiB: round(Buffer.byteLength(graphText) / 1024 / 1024)
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

function benchmarkSubmaps(graph) {
  const seed = graph.nodes[0]?.id
  if (!seed) {
    return undefined
  }
  const options = { clock: { nowIso: () => '2030-01-01T00:00:00.000Z' } }
  const previous = createSubmap(graph, { id: 'benchmark', selectors: { nodeIds: [seed] } }, options)
  const current = createSubmap(
    graph,
    { id: 'benchmark', selectors: { nodeIds: [seed] }, traversal: { direction: 'both', maxDepth: 2 } },
    options
  )
  return compareSubmaps(previous, current)
}

async function measure(operation) {
  const start = performance.now()
  const value = await operation()
  return { elapsed: performance.now() - start, value }
}

function benchmarkPlatform(root) {
  return createNodePlatform({
    processRef: {
      argv: ['node', 'benchmark', '--config', 'project-map.json'],
      env: {},
      cwd: () => root,
      exit: (code) => {
        throw new Error(`Unexpected benchmark exit ${code}.`)
      }
    }
  })
}

function selectedSizes(args, environmentValue) {
  if (args.includes('--all')) {
    return [...BENCHMARK_SIZES]
  }
  const values = environmentValue?.split(',').map(Number).filter(Number.isInteger)
  return values?.length ? values : [BENCHMARK_SIZES[0]]
}

function round(value) {
  return Math.round(value * 100) / 100
}
