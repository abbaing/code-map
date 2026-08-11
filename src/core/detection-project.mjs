import path from 'node:path'
import { assertDetectionFiles, readJson, titleCase } from '#core/detection-files.mjs'
import { createStackDetectorRegistry, detectStacks } from '#core/detection-stacks.mjs'
import { detectAliases, detectFrontend, detectModules, detectSourceRoots } from '#core/detection-structure.mjs'
import { detectBackend, detectLayers } from '#core/detection-presets.mjs'

export function detectProject(repoRoot, files) {
  const packageJson = ['front', 'frontend', 'client', '']
    .map((directory) => readJson(path.join(repoRoot, directory, 'package.json'), files))
    .find(Boolean)
  const rawName = packageJson?.name ?? path.basename(repoRoot)
  return {
    name: titleCase(rawName.replace(/^@[^/]+\//, '')),
    graphOutput: '.code-map/graph.json',
    submapsDirectory: '.code-map/submaps'
  }
}

export function detect(repoRoot, options = {}) {
  const { files, detectors = createStackDetectorRegistry() } = options
  const evidence = detectEvidence(repoRoot, files, detectors)
  const { roots, stacks } = evidence
  const backend = detectBackend(repoRoot, roots.backend, stacks.backendStack)
  return {
    schemaVersion: 1,
    project: detectProject(repoRoot, files),
    sourceRoots: { frontend: roots.frontend, ...(roots.backend ? { backend: roots.backend } : {}) },
    templates: { enabled: enabledTemplates(stacks) },
    ignoredDirs: ['node_modules', 'dist', 'build', 'coverage', 'bin', 'obj', '.git'],
    imports: { aliases: detectAliases(repoRoot, roots.frontend, files) },
    modules: evidence.modules,
    layers: detectLayers(stacks.frontendFramework, stacks.backendStack),
    types: defaultTypes,
    frontend: detectFrontend(repoRoot, roots.frontend, files),
    rules: defaultRules,
    ...(backend ? { backend } : {})
  }
}

export function detectSummary(repoRoot, options = {}) {
  const { files, detectors = createStackDetectorRegistry() } = options
  const { roots, stacks, modules } = detectEvidence(repoRoot, files, detectors)
  return {
    frontendRoot: roots.frontend,
    backendRoot: roots.backend,
    frontendFramework: stacks.frontendFramework,
    backendStack: stacks.backendStack,
    moduleCount: Object.keys(modules.labels).length
  }
}

function detectEvidence(repoRoot, files, detectors) {
  assertDetectionFiles(files)
  const roots = detectSourceRoots(repoRoot, files)
  return {
    roots,
    stacks: detectStacks(repoRoot, roots, files, detectors),
    modules: detectModules(repoRoot, roots.frontend, roots.backend, files)
  }
}

function enabledTemplates({ frontendFramework, backendStack }) {
  return [
    'filesystem',
    'typescript',
    ...(frontendFramework === 'react' ? ['react', 'architecture.feature-sliced', 'architecture.mvvm'] : []),
    'http-endpoints',
    ...(backendStack === 'dotnet'
      ? [
          'csharp',
          'dotnet-api',
          'architecture.mvc',
          'architecture.clean-architecture',
          'architecture.cqrs',
          'entity-framework'
        ]
      : []),
    'coverage',
    'quality'
  ]
}

const defaultTypes = {
  labels: {
    auxiliary: 'Auxiliary',
    command: 'Command',
    component: 'Component',
    controller: 'Controller',
    endpoint: 'API Endpoint',
    entity: 'Entity',
    handler: 'Handler',
    hook: 'Hook',
    'main-component': 'Main Component',
    page: 'Page',
    query: 'Query',
    repository: 'Repository',
    route: 'Route',
    service: 'Service',
    store: 'Store',
    subcomponent: 'Subcomponent',
    table: 'DB Table'
  },
  colors: {
    route: '#7c3aed',
    page: '#0891b2',
    'main-component': '#0891b2',
    component: '#0891b2',
    subcomponent: '#0891b2',
    hook: '#2563eb',
    service: '#2563eb',
    repository: '#2563eb',
    endpoint: '#c2410c',
    controller: '#c2410c',
    query: '#15803d',
    command: '#15803d',
    handler: '#15803d',
    entity: '#9333ea',
    table: '#9333ea',
    auxiliary: '#94a3b8',
    store: '#64748b'
  }
}

const defaultRules = {
  enabled: [
    'technology.typescript.relative-imports',
    'technology.typescript.no-any',
    'framework.react.component-max-lines',
    'framework.react.route-file-shape'
  ],
  options: { 'framework.react.component-max-lines': { max: 200 } },
  suppressions: []
}
