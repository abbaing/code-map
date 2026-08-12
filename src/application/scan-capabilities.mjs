import { capabilityInput, deepFreeze } from '#templates/contracts.mjs'
import { applyCoverage } from '#app/scan-coverage.mjs'
import { trackInternalComponents } from '#app/scan-internals.mjs'

export function createScanCapabilities({
  graph,
  projectContext,
  registry,
  files,
  findingSink,
  findingSource,
  sourceReader,
  sourceDocuments
}) {
  const { projectMap } = projectContext
  return {
    graph,
    projectMap,
    projectContext,
    registry,
    files,
    findingSink,
    findingSource,
    sourceReader,
    sourceDocuments,
    applyCoverage: () => applyCoverage(graph, files.testFiles, projectContext, sourceDocuments),
    trackInternalComponents: () => trackInternalComponents(graph)
  }
}

export function runRegisteredScanners(registry, capabilities) {
  const results = { frontEndpointIds: Object.freeze([]), controllerEndpoints: Object.freeze([]) }
  for (const scanner of registry.capabilities.scanners) {
    const result = scanner.run(capabilityInput(scanner, { ...capabilities, ...results }))
    if (scanner.assign) {
      results[scanner.assign] = deepFreeze(result ?? [])
    }
  }
  return deepFreeze(results)
}

export function runRegisteredEnrichers(registry, capabilities, scannerResults) {
  const context = { ...capabilities, ...scannerResults }
  const enrichers = registry.capabilities.enrichers.toSorted(
    (left, right) => (left.priority ?? 0) - (right.priority ?? 0)
  )
  for (const enricher of enrichers) {
    enricher.run(capabilityInput(enricher, context))
  }
}
