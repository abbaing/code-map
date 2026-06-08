#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getConfigPathFromArgs, loadProjectMap, getProjectMap, resolveRepoPath } from './config.mjs'
import { detect, detectSummary } from './detect.mjs'
import { writeGraph } from './scan.mjs'
import { listTemplates, loadTemplatePlugins } from './templates/registry.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = process.cwd()

const args = process.argv.slice(2)
const hasFlag = flag => args.includes(flag)

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`
code-map - architectural graph generator

Usage:
  node tools/code-map/cli.mjs                  Scan once and serve viewer
  node tools/code-map/cli.mjs --config <path>  Use explicit project-map.json
  node tools/code-map/cli.mjs --init           Detect and write project-map.json, then exit
  node tools/code-map/cli.mjs --init --out <dir>  Write project-map.json to directory
  node tools/code-map/cli.mjs --scan           Scan only, no viewer
  node tools/code-map/cli.mjs --scan --config <path>  Scan with explicit config, no viewer
  node tools/code-map/cli.mjs --templates      List composable templates
  node tools/code-map/cli.mjs --help           Show this help

Environment variables:
  CODE_MAP_CONFIG   Path to project-map.json (same as --config)
  CODE_MAP_PORT     Port for the viewer server (default: 4179)

Config:
  --config may point anywhere in the repo. Plugin paths are resolved relative
  to that project-map.json; graphOutput is resolved from the current directory.
`.trim())
  process.exit(0)
}

if (hasFlag('--templates')) {
  for (const template of listTemplates()) {
    console.log(`${template.id}\t${template.stage}\t${template.description}`)
  }
  process.exit(0)
}

// ── --init: detect + write project-map.json ───────────────────────────────────

if (hasFlag('--init')) {
  const summary = detectSummary(repoRoot)
  console.log(`Detected: ${summary.frontendFramework ?? 'unknown'} frontend, ${summary.backendStack ?? 'none'} backend, ${summary.moduleCount} modules`)

  const config = detect(repoRoot)

  const outIndex = args.indexOf('--out')
  const outDir = outIndex >= 0 ? path.resolve(args[outIndex + 1]) : repoRoot
  const projectSlug = (config.project?.name ?? 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const outFile = path.join(outDir, `${projectSlug}.project-map.json`)

  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(outFile, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  console.log(`Written to ${path.relative(repoRoot, outFile)}`)
  console.log('Review and adjust the file, then run: npx code-map --config ' + path.relative(repoRoot, outFile))
  process.exit(0)
}

// ── Resolve config: explicit path or zero-config detection ────────────────────

const explicitConfigPath = (() => {
  const configIndex = args.indexOf('--config')
  if (configIndex >= 0 && args[configIndex + 1]) return path.resolve(args[configIndex + 1])
  if (process.env.CODE_MAP_CONFIG) return path.resolve(process.env.CODE_MAP_CONFIG)
  return null
})()

const configPath = explicitConfigPath ?? getConfigPathFromArgs()
let pluginBasePath = configPath

if (configPath) {
  if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`)
    process.exit(1)
  }
  loadProjectMap(configPath)
  console.log(`Using config: ${path.relative(repoRoot, configPath)}`)
} else {
  const summary = detectSummary(repoRoot)
  console.log(`Auto-detected: ${summary.frontendFramework ?? 'unknown'} + ${summary.backendStack ?? 'none'}, ${summary.moduleCount} modules`)
  console.log('Tip: run with --init to generate a project-map.json you can customize.')
  loadProjectMap(detect(repoRoot))
  pluginBasePath = path.join(repoRoot, 'project-map.json')
}

await loadTemplatePlugins(getProjectMap(), pluginBasePath ?? path.join(repoRoot, 'project-map.json'))

// ── --scan: scan only, no server ──────────────────────────────────────────────

if (hasFlag('--scan')) {
  const outArgIndex = args.indexOf('--out')
  const outputPath = outArgIndex >= 0
    ? path.resolve(args[outArgIndex + 1])
    : resolveRepoPath(getProjectMap().project.graphOutput)

  const result = writeGraph(outputPath)
  console.log(`Scan complete: ${result.stats.nodes} nodes, ${result.stats.edges} edges, ${result.stats.findings} findings`)
  process.exit(0)
}

// ── Default: scan + open viewer ───────────────────────────────────────────────

const outputPath = resolveRepoPath(getProjectMap().project.graphOutput)
writeGraph(outputPath)

const { startServer } = await import('./server.mjs')
startServer()
