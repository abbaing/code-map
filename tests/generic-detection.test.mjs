import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { detect, detectSummary } from '#node/detect-node.mjs'
import { getConfigPathFromArgs, loadProjectContext } from '#core/config.mjs'
import { writeGraph } from '#app/scan.mjs'
import { maxSourceFileBytes, readText } from '#core/scan-utils.mjs'
import { nodePlatform } from '#platform/node.mjs'
import { nodeTextWriter } from '#node/json-io.mjs'
import { buildTemplateRegistry } from '#templates/registry.mjs'

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'code-map-test-'))

try {
  const emptyDir = path.join(tempRoot, 'empty')
  fs.mkdirSync(emptyDir)
  const discoveryOptions = { cwd: emptyDir, fileSystem: nodePlatform.fileSystem }
  assert.equal(
    getConfigPathFromArgs(['code-map'], discoveryOptions),
    null,
    'missing config must not fall back to packaged preset'
  )

  const hiddenConfigDir = path.join(emptyDir, '.code-map')
  const hiddenConfig = path.join(hiddenConfigDir, 'demo.project-map.json')
  fs.mkdirSync(hiddenConfigDir)
  fs.writeFileSync(hiddenConfig, '{}\n', 'utf8')
  assert.equal(
    getConfigPathFromArgs(['code-map'], discoveryOptions),
    hiddenConfig,
    'configs stored in .code-map should be discovered'
  )
  fs.rmSync(hiddenConfigDir, { recursive: true })

  const localConfig = path.join(emptyDir, 'demo.project-map.json')
  fs.writeFileSync(localConfig, '{}\n', 'utf8')
  assert.equal(
    getConfigPathFromArgs(['code-map'], discoveryOptions),
    localConfig,
    'local *.project-map.json should be discovered'
  )

  const environmentConfig = path.join(tempRoot, 'env.project-map.json')
  assert.equal(
    getConfigPathFromArgs(['code-map'], { ...discoveryOptions, configPath: environmentConfig }),
    environmentConfig,
    'CODE_MAP_CONFIG should win over local discovery'
  )

  const explicitConfig = path.join(tempRoot, 'explicit.project-map.json')
  assert.equal(
    getConfigPathFromArgs(['code-map', '--config', explicitConfig], {
      ...discoveryOptions,
      configPath: environmentConfig
    }),
    explicitConfig,
    '--config should win over env vars'
  )
} finally {
  // no process-wide environment or working-directory mutation is required
}

const detectedRepo = path.join(tempRoot, 'detected')
fs.mkdirSync(path.join(detectedRepo, 'front/src/features/accounts'), { recursive: true })
fs.mkdirSync(path.join(detectedRepo, 'back/Demo.Api'), { recursive: true })
fs.writeFileSync(
  path.join(detectedRepo, 'front/package.json'),
  JSON.stringify({ dependencies: { react: '18.0.0', 'react-dom': '18.0.0' } }),
  'utf8'
)
fs.writeFileSync(path.join(detectedRepo, 'back/Demo.Api/Demo.Api.csproj'), '<Project />\n', 'utf8')
fs.writeFileSync(path.join(detectedRepo, 'front/src/App.tsx'), 'export function App() { return null }\n', 'utf8')

const summary = detectSummary(detectedRepo)
assert.deepEqual(
  {
    frontendRoot: summary.frontendRoot,
    backendRoot: summary.backendRoot,
    frontendFramework: summary.frontendFramework,
    backendStack: summary.backendStack
  },
  { frontendRoot: 'front/src', backendRoot: 'back', frontendFramework: 'react', backendStack: 'dotnet' },
  'detect should support front/src + back repositories'
)

const detectedConfig = detect(detectedRepo)
assert.equal(detectedConfig.sourceRoots.frontend, 'front/src')
assert.equal(detectedConfig.sourceRoots.backend, 'back')
assert.equal(
  detectedConfig.project.graphOutput,
  '.code-map/graph.json',
  'auto-detected projects must keep generated graphs under .code-map'
)

const frontendOnlyRoot = path.join(tempRoot, 'frontend-only')
fs.mkdirSync(path.join(frontendOnlyRoot, 'src'), { recursive: true })
fs.writeFileSync(path.join(frontendOnlyRoot, 'src/index.ts'), 'const value: any = 1\nexport { value }\n', 'utf8')
const oversizedSourcePath = path.join(frontendOnlyRoot, 'src/oversized.ts')
fs.writeFileSync(oversizedSourcePath, '')
fs.truncateSync(oversizedSourcePath, maxSourceFileBytes + 1)

const frontendOnlyContext = loadProjectContext(
  {
    schemaVersion: 1,
    project: { name: 'Frontend Only', graphOutput: path.join(tempRoot, 'frontend-only.graph.json') },
    sourceRoots: { frontend: path.join(frontendOnlyRoot, 'src') },
    templates: { enabled: ['filesystem', 'typescript', 'quality'] },
    imports: { aliases: [] },
    modules: { shared: 'shared', frontendFeaturePattern: '^$', labels: {} },
    layers: [{ id: 'ui-component-logic', label: 'Components' }]
  },
  { platform: nodePlatform }
)

assert.throws(
  () => writeGraph(path.join(tempRoot, 'missing-registry.graph.json'), frontendOnlyContext, { writer: nodeTextWriter }),
  /Template registry capabilities must be an object/u
)
const frontendOnlyGraph = writeGraph(path.join(tempRoot, 'frontend-only.graph.json'), frontendOnlyContext, {
  registry: buildTemplateRegistry(frontendOnlyContext.projectMap),
  writer: nodeTextWriter
})
assert.equal(frontendOnlyGraph.stats.backFiles, 0, 'frontend-only scan should not require sourceRoots.backend')
assert.equal(
  frontendOnlyGraph.stats.skippedFiles,
  1,
  'oversized source files must be counted once across template discovery passes'
)
assert.equal(
  frontendOnlyGraph.nodes.some((node) => node.path?.endsWith('/oversized.ts')),
  false,
  'oversized source files must not enter the graph'
)
assert.match(frontendOnlyGraph.warnings.join('\n'), /1 source file larger than 2 MiB was skipped/u)
assert.throws(
  () => readText(oversizedSourcePath, nodePlatform.fileSystem),
  (error) => error.code === 'SOURCE_FILE_TOO_LARGE',
  'direct scanner reads must enforce the same size limit'
)

const templateDefaultsContext = loadProjectContext(
  {
    schemaVersion: 1,
    project: { name: 'Template Defaults', graphOutput: path.join(tempRoot, 'template-defaults.graph.json') },
    sourceRoots: { frontend: path.join(frontendOnlyRoot, 'src') },
    templates: { enabled: ['filesystem', 'typescript', 'react', 'quality'] },
    imports: { aliases: [] },
    modules: { frontendFeaturePattern: '^$' }
  },
  { platform: nodePlatform }
)

const templateDefaultsGraph = writeGraph(path.join(tempRoot, 'template-defaults.graph.json'), templateDefaultsContext, {
  registry: buildTemplateRegistry(templateDefaultsContext.projectMap),
  writer: nodeTextWriter
})
assert.equal(
  templateDefaultsGraph.projectMap.layers.some((layer) => layer.id === 'ui-route'),
  true,
  'template layers should be exported without config layers'
)
assert.equal(
  templateDefaultsGraph.projectMap.types.labels.component,
  'Component',
  'template type labels should be exported without config types'
)

fs.rmSync(tempRoot, { recursive: true, force: true })
console.log('generic detection tests passed')
