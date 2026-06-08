import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { detect, detectSummary } from '../detect.mjs'
import { getConfigPathFromArgs, loadProjectMap } from '../config.mjs'
import { writeGraph } from '../scan.mjs'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(testDir, '..')

function scanTypeScriptFixture(name) {
  const configPath = path.join(packageRoot, 'fixtures/generic-templates/typescript/project-map.json')
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  config.project.graphOutput = path.join(process.env.TEMP ?? process.env.TMP ?? '.', `${name}.graph.json`)
  config.project.runtimeLinks = path.join(packageRoot, 'runtime-links.json')
  config.sourceRoots.frontend = path.join(packageRoot, 'fixtures/generic-templates/typescript/front/src')
  delete config.sourceRoots.backend
  const outputPath = path.join(process.env.TEMP ?? process.env.TMP ?? '.', `${name}.graph.json`)
  loadProjectMap(config)
  return writeGraph(outputPath)
}

function scanPackageFixture(relativeConfigPath, name) {
  const configPath = path.join(packageRoot, relativeConfigPath)
  const outputPath = path.join(process.env.TEMP ?? process.env.TMP ?? '.', `${name}.graph.json`)
  loadProjectMap(configPath)
  return writeGraph(outputPath)
}

const typescriptGraph = scanTypeScriptFixture('typescript-template-fixture')
const typeScriptRules = new Set(typescriptGraph.findings.map(finding => finding.ruleId))

assert.equal(typeScriptRules.has('technology.typescript.relative-imports'), true, 'typescript template should detect relative imports')
assert.equal(typeScriptRules.has('technology.typescript.no-any'), true, 'typescript template should detect any')
assert.equal([...typeScriptRules].every(ruleId => ruleId.startsWith('technology.') || ruleId.startsWith('framework.')), true, 'generic templates must emit generic rule ids')

const architectureGraph = scanPackageFixture('fixtures/generic-templates/architecture/project-map.json', 'architecture-template-fixture')
const architectureRules = new Set(architectureGraph.findings.map(finding => finding.ruleId))

for (const ruleId of [
  'framework.react.component-folder-entry',
  'architecture.mvvm.thin-view-entry',
  'architecture.feature-sliced.no-cross-feature-internals',
  'architecture.mvvm.viewmodel-hook-naming',
  'architecture.layered.no-ui-imports-in-data-adapters',
  'architecture.mvc.thin-controller',
  'architecture.clean-architecture.layer-boundaries'
]) {
  assert.equal(architectureRules.has(ruleId), true, `architecture fixture should emit ${ruleId}`)
}

const originalCwd = process.cwd()
const originalConfigEnv = process.env.CODE_MAP_CONFIG
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'code-map-test-'))

try {
  const emptyDir = path.join(tempRoot, 'empty')
  fs.mkdirSync(emptyDir)
  process.chdir(emptyDir)
  delete process.env.CODE_MAP_CONFIG
  assert.equal(getConfigPathFromArgs(['code-map']), null, 'missing config must not fall back to packaged preset')

  const localConfig = path.join(emptyDir, 'demo.project-map.json')
  fs.writeFileSync(localConfig, '{}\n', 'utf8')
  assert.equal(getConfigPathFromArgs(['code-map']), localConfig, 'local *.project-map.json should be discovered')

  process.env.CODE_MAP_CONFIG = path.join(tempRoot, 'env.project-map.json')
  assert.equal(getConfigPathFromArgs(['code-map']), path.join(tempRoot, 'env.project-map.json'), 'CODE_MAP_CONFIG should win over local discovery')

  const explicitConfig = path.join(tempRoot, 'explicit.project-map.json')
  assert.equal(getConfigPathFromArgs(['code-map', '--config', explicitConfig]), explicitConfig, '--config should win over env vars')
} finally {
  process.chdir(originalCwd)
  if (originalConfigEnv === undefined) delete process.env.CODE_MAP_CONFIG
  else process.env.CODE_MAP_CONFIG = originalConfigEnv
}

const detectedRepo = path.join(tempRoot, 'detected')
fs.mkdirSync(path.join(detectedRepo, 'front/src/features/accounts'), { recursive: true })
fs.mkdirSync(path.join(detectedRepo, 'back/Demo.Api'), { recursive: true })
fs.writeFileSync(path.join(detectedRepo, 'front/package.json'), JSON.stringify({ dependencies: { react: '18.0.0', 'react-dom': '18.0.0' } }), 'utf8')
fs.writeFileSync(path.join(detectedRepo, 'back/Demo.Api/Demo.Api.csproj'), '<Project />\n', 'utf8')
fs.writeFileSync(path.join(detectedRepo, 'front/src/App.tsx'), 'export function App() { return null }\n', 'utf8')

const summary = detectSummary(detectedRepo)
assert.deepEqual(
  { frontendRoot: summary.frontendRoot, backendRoot: summary.backendRoot, frontendFramework: summary.frontendFramework, backendStack: summary.backendStack },
  { frontendRoot: 'front/src', backendRoot: 'back', frontendFramework: 'react', backendStack: 'dotnet' },
  'detect should support front/src + back repositories'
)

const detectedConfig = detect(detectedRepo)
assert.equal(detectedConfig.sourceRoots.frontend, 'front/src')
assert.equal(detectedConfig.sourceRoots.backend, 'back')

const frontendOnlyRoot = path.join(tempRoot, 'frontend-only')
fs.mkdirSync(path.join(frontendOnlyRoot, 'src'), { recursive: true })
fs.writeFileSync(path.join(frontendOnlyRoot, 'src/index.ts'), 'const value: any = 1\nexport { value }\n', 'utf8')

loadProjectMap({
  schemaVersion: 1,
  project: { name: 'Frontend Only', graphOutput: path.join(tempRoot, 'frontend-only.graph.json') },
  sourceRoots: { frontend: path.join(frontendOnlyRoot, 'src') },
  templates: { enabled: ['filesystem', 'typescript', 'quality'] },
  imports: { aliases: [] },
  modules: { shared: 'shared', frontendFeaturePattern: '^$', labels: {} },
  layers: [{ id: 'ui-component-logic', label: 'Components' }]
})

const frontendOnlyGraph = writeGraph(path.join(tempRoot, 'frontend-only.graph.json'))
assert.equal(frontendOnlyGraph.stats.backFiles, 0, 'frontend-only scan should not require sourceRoots.backend')

loadProjectMap({
  schemaVersion: 1,
  project: { name: 'Template Defaults', graphOutput: path.join(tempRoot, 'template-defaults.graph.json') },
  sourceRoots: { frontend: path.join(frontendOnlyRoot, 'src') },
  templates: { enabled: ['filesystem', 'typescript', 'react', 'quality'] },
  imports: { aliases: [] },
  modules: { frontendFeaturePattern: '^$' }
})

const templateDefaultsGraph = writeGraph(path.join(tempRoot, 'template-defaults.graph.json'))
assert.equal(templateDefaultsGraph.projectMap.layers.some(layer => layer.id === 'ui-route'), true, 'template layers should be exported without config layers')
assert.equal(templateDefaultsGraph.projectMap.types.labels.component, 'Component', 'template type labels should be exported without config types')

console.log('generic template fixtures passed')
