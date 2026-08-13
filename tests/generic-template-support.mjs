import fs from 'node:fs'
import path from 'node:path'
import { loadProjectContext } from '#core/config.mjs'
import { writeGraph } from '#app/scan.mjs'
import { escapeRegExp } from '#core/source-analysis.mjs'
import { nodePlatform } from '#platform/node.mjs'
import { nodeTextWriter } from '#node/json-io.mjs'
import { architectureFixture, createFixtureTree, typescriptFixture } from '#tests/fixtures.mjs'
import { buildTemplateRegistry } from '#templates/registry.mjs'

export const fixtureRoot = createFixtureTree(typescriptFixture, architectureFixture)

function repoRelative(absolutePath) {
  return path.relative(process.cwd(), absolutePath).replaceAll(path.sep, '/')
}

export function scanTypeScriptFixture(name) {
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

export function scanArchitectureFixture(name) {
  const frontendRoot = path.join(fixtureRoot, 'architecture/front/src')
  const backendRoot = path.join(fixtureRoot, 'architecture/back')
  const projectContext = loadProjectContext(architectureProjectMap(name, frontendRoot, backendRoot), {
    platform: nodePlatform
  })
  return writeGraph(path.join(fixtureRoot, `${name}.graph.json`), projectContext, scanOptions(projectContext))
}

function architectureProjectMap(name, frontendRoot, backendRoot) {
  const frontendPattern = escapeRegExp(repoRelative(frontendRoot))
  const backendPattern = escapeRegExp(repoRelative(backendRoot))
  return {
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
        'csharp',
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
    rules: architectureRules(frontendPattern),
    backend: architectureBackend()
  }
}

function architectureRules(frontendPattern) {
  return {
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
  }
}

function architectureBackend() {
  return {
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
}

function scanOptions(projectContext) {
  return {
    registry: buildTemplateRegistry(projectContext.projectMap),
    writer: nodeTextWriter
  }
}

export function cleanupFixtures() {
  fs.rmSync(fixtureRoot, { recursive: true, force: true })
}
