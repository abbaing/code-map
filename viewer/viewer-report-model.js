import { isCoverable } from '#viewer/viewer-filters.js'
import { unique } from '#viewer/viewer-utils.js'

export function buildViewerReport(graph, now = Date.now()) {
  const { nodes, stats, generatedAt } = graph
  const coverable = nodes.filter((node) => isCoverable(node, graph.projectMap))
  const covered = coverable.filter((node) => node.meta?.coverage?.hasCoverage)
  const findings = graph.findings ?? []
  const generated = new Date(generatedAt)
  return {
    stats,
    findings,
    generated,
    timeAgo: formatTimeAgo(generated, now),
    moduleCount: unique(nodes.map((node) => node.module || 'shared')).length,
    coverable: coverable.length,
    uncovered: coverable.length - covered.length,
    coveragePercent: coverable.length ? Math.round((covered.length / coverable.length) * 100) : null,
    suppressed: graph.suppressedFindings ?? [],
    templates: graph.templates ?? [],
    architecture: graph.architecture ?? [],
    scopes: findingScopes(findings)
  }
}

function findingScopes(findings) {
  return findings.reduce((scopes, finding) => {
    const scope = ['repo', 'framework', 'technology'].find((name) => finding.ruleId?.startsWith(`${name}.`)) ?? 'other'
    scopes[scope] = (scopes[scope] ?? 0) + 1
    return scopes
  }, {})
}

function formatTimeAgo(date, now) {
  const minutes = Math.round((now - date) / 60000)
  if (minutes < 1) {
    return 'just now'
  }
  if (minutes < 60) {
    return `${minutes}m ago`
  }
  const hours = Math.round(minutes / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}
