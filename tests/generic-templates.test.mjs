import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { detect, detectSummary } from '../detect.mjs'
import { getConfigPathFromArgs, loadProjectMap } from '../config.mjs'
import { writeGraph } from '../scan.mjs'
import { escapeRegExp } from '../scan-utils.mjs'
import { architectureFixture, createFixtureTree, typescriptFixture } from './fixtures.mjs'

const fixtureRoot = createFixtureTree(typescriptFixture, architectureFixture)

function repoRelative(absolutePath) {
  return path.relative(process.cwd(), absolutePath).replaceAll(path.sep, '/')
}

function scanTypeScriptFixture(name) {
  const frontendRoot = path.join(fixtureRoot, 'typescript/front/src')
  loadProjectMap({
    schemaVersion: 1,
    project: {
      name: 'TypeScript Fixture',
      graphOutput: path.join(fixtureRoot, `${name}.graph.json`)
    },
    sourceRoots: { frontend: frontendRoot },
    templates: { enabled: ['filesystem', 'typescript', 'quality'] },
    imports: { aliases: [] },
    modules: { shared: 'shared', labels: {} },
    layers: [{ id: 'auxiliary', label: 'Auxiliary' }],
    frontend: { entryPoints: [], classifiers: [], coverableTypes: [] },
    rules: { enabled: [], options: {}, suppressions: [] },
    backend: { classifiers: [] }
  })
  return writeGraph(path.join(fixtureRoot, `${name}.graph.json`))
}

function scanArchitectureFixture(name) {
  const frontendRoot = path.join(fixtureRoot, 'architecture/front/src')
  const backendRoot = path.join(fixtureRoot, 'architecture/back')
  const frontendPattern = escapeRegExp(repoRelative(frontendRoot))
  const backendPattern = escapeRegExp(repoRelative(backendRoot))
  loadProjectMap({
    schemaVersion: 1,
    project: {
      name: 'Architecture Fixture',
      graphOutput: path.join(fixtureRoot, `${name}.graph.json`)
    },
    sourceRoots: { frontend: frontendRoot, backend: backendRoot },
    templates: {
      enabled: [
        'filesystem',
        'typescript',
        'react',
        'architecture.feature-sliced',
        'architecture.mvvm',
        'dotnet-api',
        'architecture.mvc',
        'architecture.clean-architecture',
        'quality'
      ]
    },
    imports: { aliases: [{ prefix: '@/', path: frontendRoot }] },
    modules: {
      shared: 'shared',
      frontendFeaturePattern: `^${frontendPattern}/features/([^/]+)`,
      backendProjectFolderPattern: `^${backendPattern}/[^/]+/([^/]+)`,
      backendControllerPattern: `^${backendPattern}/[^/]+/Controllers/(.+?)Controller\\.cs$`,
      backendEntityDomainPattern: `^${backendPattern}/[^/]+/Entities/([^/]+)`,
      labels: {}
    },
    layers: [
      { id: 'ui-component-logic', label: 'Components' },
      { id: 'ui-main-component', label: 'Main Components' },
      { id: 'front-repository', label: 'Repositories' },
      { id: 'api-controller', label: 'Controllers' },
      { id: 'domain', label: 'Domain' }
    ],
    frontend: {
      entryPoints: [],
      featureFolderPattern: '/features/{module}/',
      classifiers: [{ contains: '/repositories/', type: 'repository', layer: 'front-repository' }],
      coverableTypes: []
    },
    rules: {
      enabled: [
        'framework.react.component-folder-entry',
        'architecture.mvvm.thin-view-entry',
        'architecture.feature-sliced.no-cross-feature-internals',
        'architecture.mvvm.viewmodel-hook-naming',
        'architecture.layered.no-ui-imports-in-data-adapters',
        'architecture.mvc.thin-controller',
        'architecture.clean-architecture.layer-boundaries'
      ],
      options: {
        'framework.react.component-folder-entry': {
          includePatterns: [`^${frontendPattern}/features/[^/]+/components/`]
        },
        'architecture.clean-architecture.layer-boundaries': { namespacePrefix: 'Demo' }
      },
      suppressions: []
    },
    backend: {
      entryPointSuffixes: ['/Program.cs'],
      dtoPathFragment: '/DTOs/',
      validatorPathFragment: '/Validators/',
      mappingPathFragment: '/Mappings/',
      controllerPathFragment: '/Controllers/',
      handlerPathFragment: '/Handlers/',
      repositoryPathFragment: '/Repositories/',
      entityConfigurationPathFragment: '/Configurations/Entities/',
      dataContextPathFragment: '/Data/Context/',
      entityPathFragment: '/Entities/',
      classifiers: [
        { contains: '/Controllers/', type: 'controller', layer: 'api-controller' },
        { contains: '/Queries/', type: 'query', layer: 'application-boundary' },
        { contains: '/Commands/', type: 'command', layer: 'application-boundary' },
        { contains: '/Entities/', type: 'entity', layer: 'domain' }
      ]
    }
  })
  return writeGraph(path.join(fixtureRoot, `${name}.graph.json`))
}

const typescriptGraph = scanTypeScriptFixture('typescript-template-fixture')
const typeScriptRules = new Set(typescriptGraph.findings.map(finding => finding.ruleId))

assert.equal(typeScriptRules.has('technology.typescript.relative-imports'), true, 'typescript template should detect relative imports')
assert.equal(typeScriptRules.has('technology.typescript.no-any'), true, 'typescript template should detect any')
assert.equal([...typeScriptRules].every(ruleId => ruleId.startsWith('technology.') || ruleId.startsWith('framework.')), true, 'generic templates must emit generic rule ids')

const architectureGraph = scanArchitectureFixture('architecture-template-fixture')
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

const architectureNodes = new Map(architectureGraph.nodes.map(node => [node.label, node]))
const architectureOrphans = new Set(architectureGraph.orphans.map(orphan => orphan.label))

assert.equal(
  ['command', 'query'].includes(architectureNodes.get('ICommand.cs')?.type),
  false,
  'marker interfaces must not be classified as request nodes'
)
assert.equal(
  architectureNodes.get('CreateAccountCommand')?.type,
  'command',
  'commands under /Commands/ should be classified as command nodes'
)
assert.equal(
  architectureOrphans.has('CreateAccountCommand'),
  false,
  'a [FromBody] dispatched command must receive a sends edge from its controller'
)
assert.equal(
  architectureOrphans.has('NotifyAccountCommand'),
  false,
  'a command dispatched from an application handler must receive a sends edge'
)

const orphanPaths = new Set(architectureGraph.orphans.map(orphan => orphan.path))
const duplicateRequestPaths = architectureGraph.nodes
  .filter(node => node.path?.endsWith('/Queries/GetStatusQuery.cs'))
  .map(node => node.path)

assert.equal(duplicateRequestPaths.length, 2, 'fixture should expose the same request name in two modules')
for (const requestPath of duplicateRequestPaths) {
  assert.equal(
    orphanPaths.has(requestPath),
    false,
    `same-named request in distinct modules must each be linked to its own dispatcher (${requestPath})`
  )
}

assert.equal(
  architectureOrphans.has('GhostCommand.cs'),
  true,
  'a command only referenced inside a comment must not receive a sends edge'
)

const commentedImportEdge = architectureGraph.edges.find(edge =>
  edge.type === 'imports'
  && edge.from.endsWith('/reports/hooks/useReports.ts')
  && edge.to.endsWith('/reports/components/Widget.tsx'))
assert.equal(commentedImportEdge, undefined, 'a commented-out import must not create an imports edge')

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

fs.rmSync(fixtureRoot, { recursive: true, force: true })
fs.rmSync(tempRoot, { recursive: true, force: true })

console.log('generic template fixtures passed')
