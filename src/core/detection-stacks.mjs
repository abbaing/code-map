import path from 'node:path'
import { findFileBySuffix, readJson } from '#core/detection-files.mjs'

const frontendDependencies = { react: ['react', 'react-dom'], vue: ['vue'], angular: ['@angular/core'] }
const nodeBackendMarkers = ['express', 'fastify', 'koa', 'hapi', 'nestjs', '@nestjs/core']

const defaultFrontendDetectors = Object.entries(frontendDependencies).map(([id, dependencies]) =>
  dependencyDetector(id, dependencies)
)

const defaultBackendDetectors = [
  {
    id: 'dotnet',
    detect: ({ backendPath, repoRoot, files }) =>
      Boolean(findFileBySuffix(backendPath, '.csproj', files) ?? findFileBySuffix(repoRoot, '.csproj', files))
  },
  { id: 'go', detect: ({ repoRoot, files }) => files.exists(path.join(repoRoot, 'go.mod')) },
  { id: 'python', detect: ({ repoRoot, files }) => files.exists(path.join(repoRoot, 'requirements.txt')) },
  { id: 'node', detect: ({ backendPkg }) => hasDependency(backendPkg, nodeBackendMarkers) }
]

export function createStackDetectorRegistry({
  frontend = defaultFrontendDetectors,
  backend = defaultBackendDetectors
} = {}) {
  return Object.freeze({
    frontend: validateDetectors(frontend, 'frontend'),
    backend: validateDetectors(backend, 'backend')
  })
}

export function detectStacks(repoRoot, roots, files, detectors) {
  return {
    frontendFramework: detectFrontendStack(repoRoot, roots.frontend, files, detectors.frontend),
    backendStack: roots.backend ? detectBackendStack(repoRoot, roots.backend, files, detectors.backend) : null
  }
}

function detectFrontendStack(repoRoot, frontendRoot, files, detectors) {
  const packageDirectory = path.dirname(path.join(repoRoot, frontendRoot))
  const packageJson =
    readJson(path.join(packageDirectory, 'package.json'), files) ?? readJson(path.join(repoRoot, 'package.json'), files)
  const dependencies = dependenciesOf(packageJson)
  return firstDetected(detectors, { dependencies })
}

function detectBackendStack(repoRoot, backendRoot, files, detectors) {
  const backendPkg = ['backend', 'server', 'api']
    .map((directory) => readJson(path.join(repoRoot, directory, 'package.json'), files))
    .find(Boolean)
  return firstDetected(detectors, { repoRoot, backendPath: path.join(repoRoot, backendRoot), backendPkg, files })
}

function firstDetected(detectors, context) {
  return detectors.find((detector) => detector.detect(context))?.id ?? null
}

function dependencyDetector(id, dependencies) {
  return { id, detect: ({ dependencies: installed }) => dependencies.some((dependency) => installed[dependency]) }
}

function hasDependency(packageJson, candidates) {
  const installed = dependenciesOf(packageJson)
  return candidates.some((dependency) => installed[dependency])
}

function dependenciesOf(packageJson) {
  return { ...(packageJson?.dependencies ?? {}), ...(packageJson?.devDependencies ?? {}) }
}

function validateDetectors(detectors, kind) {
  if (!Array.isArray(detectors)) {
    throw new TypeError(`${kind} detectors must be an array.`)
  }
  const ids = new Set()
  return Object.freeze(detectors.map((detector) => validateDetector(detector, kind, ids)))
}

function validateDetector(detector, kind, ids) {
  if (!detector || typeof detector.id !== 'string' || typeof detector.detect !== 'function') {
    throw new TypeError(`${kind} detectors must declare id and detect(context).`)
  }
  if (ids.has(detector.id)) {
    throw new TypeError(`Duplicate ${kind} detector id: ${detector.id}.`)
  }
  ids.add(detector.id)
  return Object.freeze({ id: detector.id, detect: detector.detect.bind(detector) })
}
