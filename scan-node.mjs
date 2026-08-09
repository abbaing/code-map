import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getConfigPathFromArgs, loadProjectContext } from './config.mjs'
import { detect } from './detect-node.mjs'
import { nodePlatform } from './platform/node.mjs'
import { nodeTextWriter } from './json-io.mjs'
import { writeGraph } from './scan.mjs'
import { loadTemplatePlugins } from './templates/registry.mjs'

export async function runNodeScan({ platform = nodePlatform } = {}) {
  const { environment, fileSystem } = platform
  const argv = environment.args()
  const projectRoot = environment.cwd()
  const configPath = getConfigPathFromArgs(argv, {
    cwd: projectRoot,
    configPath: environment.variable('CODE_MAP_CONFIG'),
    fileSystem
  })
  const projectContext = loadProjectContext(configPath ?? detect(projectRoot, { fileSystem }), {
    repoRoot: projectRoot,
    platform
  })
  await loadTemplatePlugins(projectContext.projectMap, configPath ?? path.join(projectRoot, 'project-map.json'), {
    allow: argv.includes('--allow-plugins')
  })
  const outArgIndex = argv.indexOf('--out')
  const outputPath = outArgIndex >= 0 ? path.resolve(argv[outArgIndex + 1]) : projectContext.resolveGraphOutputPath()
  const result = writeGraph(outputPath, projectContext, { writer: nodeTextWriter })
  return { outputPath, projectContext, result }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { outputPath, projectContext, result } = await runNodeScan()
  console.log(
    `Code map written to ${projectContext.toRepoPath(outputPath)} (${result.stats.nodes} nodes, ${result.stats.edges} edges, ${result.stats.orphans} orphans).`
  )
}
