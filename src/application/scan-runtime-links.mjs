import { readText, maxSourceFileBytes } from '#core/scan-utils.mjs'
import { normalizePath } from '#core/source-analysis.mjs'

export function applyRuntimeLinks(graph, projectContext) {
  const { projectMap, resolveRepoPath } = projectContext
  const { fileSystem } = projectContext.platform
  if (!projectMap.project.runtimeLinks) {
    return
  }
  const runtimeLinksPath = resolveRepoPath(projectMap.project.runtimeLinks)
  if (!fileSystem.exists(runtimeLinksPath)) {
    return
  }
  const parsed = JSON.parse(readText(runtimeLinksPath, fileSystem, maxSourceFileBytes, projectContext.toRepoPath))
  for (const link of parsed.links ?? []) {
    const from = resolveRuntimeNode(graph, link.from)
    const to = resolveRuntimeNode(graph, link.to)
    if (!from || !to) {
      continue
    }
    graph.addEdge(from, to, link.type ?? 'runtime-link', {
      label: link.reason ?? link.type ?? 'runtime-link',
      confidence: link.confidence ?? 'manual',
      source: 'runtime-links',
      evidence: link.reason ?? `${link.from} -> ${link.to}`
    })
  }
}

function resolveRuntimeNode(graph, value) {
  if (!value) {
    return null
  }
  if (
    value.startsWith('file:') ||
    value.startsWith('endpoint:') ||
    value.startsWith('table:') ||
    value.startsWith('entity:')
  ) {
    return value
  }
  const repoPath = normalizePath(value)
  if (graph.hasNode(`file:${repoPath}`)) {
    return `file:${repoPath}`
  }
  if (graph.hasNode(value)) {
    return value
  }
  return null
}
