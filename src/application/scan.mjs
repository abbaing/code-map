import path from 'node:path'
import { validateGraphDocument } from '#core/graph.mjs'
import { assertCapabilityRegistry } from '#templates/contracts.mjs'
import { assertTextWriter } from '#core/writer-contract.mjs'
import { buildGraph, createDefaultScanPipeline } from '#app/scan-pipeline.mjs'

export { createDefaultScanPipeline } from '#app/scan-pipeline.mjs'

export function writeGraph(
  outputPath,
  projectContext,
  { pipeline = createDefaultScanPipeline(), registry, writer } = {}
) {
  if (!projectContext) {
    throw new TypeError('writeGraph requires a ProjectContext.')
  }
  assertCapabilityRegistry(registry)
  assertTextWriter(writer)
  const targetPath = outputPath ?? projectContext.resolveGraphOutputPath()
  const result = validateGraphDocument(buildGraph(projectContext, registry, pipeline))
  writer.writeText(targetPath, `${JSON.stringify(result, null, 2)}\n`)
  removeLegacyDefaultGraph(targetPath, projectContext)
  return result
}

function removeLegacyDefaultGraph(outputPath, projectContext) {
  const { fileSystem } = projectContext.platform
  const managedOutput = path.resolve(projectContext.repoRoot, '.code-map', 'graph.json')
  if (path.resolve(outputPath) !== managedOutput) {
    return
  }
  const legacyOutput = path.resolve(projectContext.repoRoot, 'graph.json')
  if (!fileSystem.exists(legacyOutput)) {
    return
  }
  try {
    const document = JSON.parse(fileSystem.readText(legacyOutput))
    if (isGeneratedGraph(document)) {
      fileSystem.remove(legacyOutput)
    }
  } catch {
    /* preserve files that are not recognizable code-map output */
  }
}

function isGeneratedGraph(document) {
  return (
    Number.isInteger(document?.version) &&
    Array.isArray(document?.nodes) &&
    Array.isArray(document?.edges) &&
    document?.projectMap &&
    document?.stats
  )
}
