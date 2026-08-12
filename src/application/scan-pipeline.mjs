import { createSourceReader } from '#core/scan-utils.mjs'
import { createParserRegistry, createSourceDocumentStore } from '#core/source-documents.mjs'
import { Graph } from '#core/graph.mjs'
import { createFindingCollector } from '#rules/findings.mjs'
import { createScanPipeline, defineScanPhase } from '#core/scan-pipeline.mjs'
import { discoverFiles } from '#app/scan-files.mjs'
import { applyRuntimeLinks } from '#app/scan-runtime-links.mjs'
import { createScanCapabilities, runRegisteredScanners, runRegisteredEnrichers } from '#app/scan-capabilities.mjs'
import { buildEffectiveProjectMap, finalizeGraphDocument } from '#app/scan-finalization.mjs'

export function createDefaultScanPipeline() {
  return createScanPipeline(defaultPhases())
}

function defaultPhases() {
  return [...sourcePhases(), ...graphPhases()]
}

function sourcePhases() {
  return [
    defineScanPhase({
      id: 'discover-files',
      requires: ['projectContext', 'registry'],
      provides: ['files'],
      run: ({ projectContext, registry }) => ({ files: discoverFiles(projectContext, registry) })
    }),
    defineScanPhase({
      id: 'prepare-source-documents',
      requires: ['projectContext', 'registry'],
      provides: ['sourceReader', 'sourceDocuments'],
      run: ({ projectContext, registry }) => {
        const sourceReader = createSourceReader(projectContext.platform.fileSystem, projectContext.toRepoPath)
        const parserRegistry = createParserRegistry(registry.capabilities.parsers)
        return {
          sourceReader,
          sourceDocuments: createSourceDocumentStore({ parserRegistry, sourceReader })
        }
      }
    }),
    defineScanPhase({
      id: 'run-scanners',
      requires: [
        'graph',
        'projectContext',
        'registry',
        'files',
        'findingSink',
        'findingSource',
        'sourceReader',
        'sourceDocuments'
      ],
      provides: ['scannerResults'],
      run: (input) => {
        const capabilities = createScanCapabilities(input)
        return { scannerResults: runRegisteredScanners(input.registry, capabilities) }
      }
    })
  ]
}

function graphPhases() {
  return [
    defineScanPhase({
      id: 'apply-runtime-links',
      requires: ['graph', 'projectContext'],
      run: ({ graph, projectContext }) => applyRuntimeLinks(graph, projectContext)
    }),
    defineScanPhase({
      id: 'run-enrichers',
      requires: [
        'graph',
        'projectContext',
        'registry',
        'files',
        'findingSink',
        'findingSource',
        'scannerResults',
        'sourceReader',
        'sourceDocuments'
      ],
      run: ({ scannerResults, ...input }) =>
        runRegisteredEnrichers(input.registry, createScanCapabilities(input), scannerResults)
    }),
    defineScanPhase({
      id: 'finalize-document',
      requires: ['graph', 'projectContext', 'registry', 'effectiveProjectMap', 'files', 'findingSource'],
      provides: ['result'],
      run: (input) => ({ result: finalizeGraphDocument(input) })
    })
  ]
}

export function buildGraph(projectContext, registry, pipeline = createDefaultScanPipeline()) {
  const { projectMap } = projectContext
  const effectiveProjectMap = buildEffectiveProjectMap(projectMap, registry)
  const graph = new Graph()
  const { sink: findingSink, source: findingSource } = createFindingCollector(projectMap)

  return pipeline.run({ graph, projectContext, registry, effectiveProjectMap, findingSink, findingSource }).result
}
