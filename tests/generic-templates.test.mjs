import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { detect, detectSummary } from '#node/detect-node.mjs'
import { getConfigPathFromArgs, loadProjectContext } from '#core/config.mjs'
import { writeGraph } from '#app/scan.mjs'
import { maxSourceFileBytes, readText } from '#core/scan-utils.mjs'
import { escapeRegExp } from '#core/source-analysis.mjs'
import { nodePlatform } from '#platform/node.mjs'
import { nodeTextWriter } from '#node/json-io.mjs'
import { architectureFixture, createFixtureTree, typescriptFixture } from '#tests/fixtures.mjs'
import { buildTemplateRegistry } from '#templates/registry.mjs'

const fixtureRoot = createFixtureTree(typescriptFixture, architectureFixture)

function repoRelative(absolutePath) {
  return path.relative(process.cwd(), absolutePath).replaceAll(path.sep, '/')
}

function scanTypeScriptFixture(name) {
  const frontendRoot = path.join(fixtureRoot, 'typescript/front/src')
  const projectContext = loadProjectContext(
    {
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
    },
    { platform: nodePlatform }
  )
  return writeGraph(path.join(fixtureRoot, `${name}.graph.json`), projectContext, scanOptions(projectContext))
}

function scanArchitectureFixture(name) {
  const frontendRoot = path.join(fixtureRoot, 'architecture/front/src')
  const backendRoot = path.join(fixtureRoot, 'architecture/back')
  const frontendPattern = escapeRegExp(repoRelative(frontendRoot))
  const backendPattern = escapeRegExp(repoRelative(backendRoot))
  const projectContext = loadProjectContext(
    {
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
    },
    { platform: nodePlatform }
  )
  return writeGraph(path.join(fixtureRoot, `${name}.graph.json`), projectContext, scanOptions(projectContext))
}

const typescriptGraph = scanTypeScriptFixture('typescript-template-fixture')
const typeScriptRules = new Set(typescriptGraph.findings.map((finding) => finding.ruleId))

assert.equal(
  typeScriptRules.has('technology.typescript.relative-imports'),
  true,
  'typescript template should detect relative imports'
)
assert.equal(typeScriptRules.has('technology.typescript.no-any'), true, 'typescript template should detect any')
assert.equal(
  [...typeScriptRules].every((ruleId) => ruleId.startsWith('technology.') || ruleId.startsWith('framework.')),
  true,
  'generic templates must emit generic rule ids'
)

const architectureGraph = scanArchitectureFixture('architecture-template-fixture')
const architectureRules = new Set(architectureGraph.findings.map((finding) => finding.ruleId))
const testedNode = architectureGraph.nodes.find((node) => node.label === 'tested.ts')
const uncoveredNode = architectureGraph.nodes.find((node) => node.label === 'uncovered.ts')

assert.ok(testedNode, 'the covered fixture source must be scanned')
assert.ok(uncoveredNode, 'the uncovered fixture source must be scanned')
assert.deepEqual(testedNode.meta?.coverage, {
  hasCoverage: true,
  tests: [testedNode.path.replace(/tested\.ts$/u, 'coverage.spec.ts')],
  testCaseCount: 1
})
assert.equal(
  uncoveredNode?.meta?.coverage,
  undefined,
  'import-shaped strings in tests must not attribute source coverage'
)

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

const architectureNodes = new Map(architectureGraph.nodes.map((node) => [node.label, node]))
const architectureOrphans = new Set(architectureGraph.orphans.map((orphan) => orphan.label))

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

const orphanPaths = new Set(architectureGraph.orphans.map((orphan) => orphan.path))
const duplicateRequestPaths = architectureGraph.nodes
  .filter((node) => node.path?.endsWith('/Queries/GetStatusQuery.cs'))
  .map((node) => node.path)

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

const createEndpoint = architectureGraph.nodes.find((node) => node.id === 'endpoint:POST /api/accounts')
const archiveEndpoint = architectureGraph.nodes.find((node) => node.id === 'endpoint:DELETE /api/accounts/{}')
const createSends = architectureGraph.edges.filter((edge) => edge.from === createEndpoint?.id && edge.type === 'sends')
const archiveSends = architectureGraph.edges.filter(
  (edge) => edge.from === archiveEndpoint?.id && edge.type === 'sends'
)
assert.deepEqual(
  createSends.map((edge) => architectureGraph.nodes.find((node) => node.id === edge.to)?.label),
  ['CreateAccountCommand'],
  'an endpoint must only dispatch the request used by its own controller action'
)
assert.deepEqual(
  archiveSends.map((edge) => architectureGraph.nodes.find((node) => node.id === edge.to)?.label),
  ['ArchiveAccountCommand'],
  'a second controller action must keep an independent request trace'
)
assert.equal(
  createEndpoint?.meta?.backend?.action,
  'Create',
  'endpoint metadata should describe the controller action without requiring a controller node in the trace'
)

const handlerNode = architectureGraph.nodes.find((node) => node.label === 'CreateAccountCommandHandler.cs')
const repositoryNode = architectureGraph.nodes.find((node) => node.label === 'AccountRepository.cs')
assert.equal(repositoryNode?.type, 'repository', 'backend repository implementations should have an architectural role')
assert.equal(
  repositoryNode?.layer,
  'backend-repository',
  'backend repositories should render after application handlers'
)
assert.equal(
  architectureGraph.edges.some(
    (edge) => edge.from === handlerNode?.id && edge.to === repositoryNode?.id && edge.type === 'depends-on'
  ),
  true,
  'constructor injection should connect a handler to the implementation of its repository interface'
)

const commentedImportEdge = architectureGraph.edges.find(
  (edge) =>
    edge.type === 'imports' &&
    edge.from.endsWith('/reports/hooks/useReports.ts') &&
    edge.to.endsWith('/reports/components/Widget.tsx')
)
assert.equal(commentedImportEdge, undefined, 'a commented-out import must not create an imports edge')

assert.equal(
  architectureGraph.nodes.find((node) => node.label === 'ReportsPage')?.type,
  'page',
  'a page directory entry should remain a page'
)
assert.equal(
  architectureGraph.nodes.find((node) => node.label === '_DateRangeSelector')?.type,
  'subcomponent',
  'nested page UI must not become a top-level page'
)
assert.equal(
  architectureGraph.nodes.find((node) => node.path?.endsWith('/reports/pages/index.ts'))?.type,
  'auxiliary',
  'a pages barrel is not a routeable page'
)

const importedConstantEndpoint = architectureGraph.nodes.find((node) => node.id === 'endpoint:GET /api/v1/admin/users')
const importedMutationEndpoint = architectureGraph.nodes.find((node) => node.id === 'endpoint:POST /api/v1/admin/users')
const importedUpdateEndpoint = architectureGraph.nodes.find((node) => node.id === 'endpoint:PUT /api/v1/admin/users/{}')
const usersRepository = architectureGraph.nodes.find((node) =>
  node.path?.endsWith('/users/repositories/UsersRepository.ts')
)
assert.equal(
  architectureGraph.edges.some(
    (edge) => edge.from === usersRepository?.id && edge.to === importedConstantEndpoint?.id && edge.type === 'calls-api'
  ),
  true,
  'frontend API wrappers must resolve imported URL constants, including aliased imports'
)
assert.equal(
  architectureGraph.edges.some(
    (edge) => edge.from === usersRepository?.id && edge.to === importedMutationEndpoint?.id && edge.type === 'calls-api'
  ),
  true,
  'positional HTTP wrappers must preserve POST semantics'
)
assert.equal(
  architectureGraph.edges.some(
    (edge) => edge.from === usersRepository?.id && edge.to === importedUpdateEndpoint?.id && edge.type === 'calls-api'
  ),
  true,
  'positional HTTP wrappers must preserve templated PUT URLs'
)

const fetchEndpoint = architectureGraph.nodes.find((node) => node.id === 'endpoint:GET /api/reports')
assert.equal(fetchEndpoint?.type, 'endpoint', 'native fetch calls should create GET endpoints by default')

for (const edge of architectureGraph.edges) {
  assert.notEqual(edge.source, 'scanner', `${edge.id} must identify the scanner that produced it`)
  assert.equal(typeof edge.source === 'string' && edge.source.length > 0, true, `${edge.id} must declare provenance`)
  assert.equal(typeof edge.evidence === 'string' && edge.evidence.length > 0, true, `${edge.id} must retain evidence`)
}

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

fs.rmSync(fixtureRoot, { recursive: true, force: true })
fs.rmSync(tempRoot, { recursive: true, force: true })

console.log('generic template fixtures passed')

function scanOptions(projectContext) {
  return {
    registry: buildTemplateRegistry(projectContext.projectMap),
    writer: nodeTextWriter
  }
}
