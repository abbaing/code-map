import { getProjectMap } from '../config.mjs'

const findings = []

export function clearFindings() {
  findings.length = 0
}

export function addFinding(data) {
  const finding = {
    id: [data.ruleId, data.nodeId, data.line ?? 0, findings.length].join(':'),
    ruleId: data.ruleId,
    severity: data.severity ?? 'warning',
    category: data.category ?? 'architecture',
    confidence: data.confidence ?? 'medium',
    effort: data.effort ?? 'medium',
    nodeId: data.nodeId,
    message: data.message,
    why: data.why,
    fixHint: data.fixHint,
    docsPath: data.docsPath,
    path: data.path,
    line: data.line,
    evidence: data.evidence,
    source: data.source ?? 'code-map'
  }
  applySuppression(finding)
  findings.push(finding)
  return finding
}

export function attachFindingsToNodes(graph) {
  const byNode = new Map()
  for (const finding of activeFindings()) {
    if (!finding.nodeId || !graph.hasNode(finding.nodeId)) continue
    const current = byNode.get(finding.nodeId) ?? []
    current.push(finding)
    byNode.set(finding.nodeId, current)
  }

  for (const [nodeId, nodeFindings] of byNode) {
    graph.addNode(nodeId, { meta: { findings: nodeFindings } })
  }
}

export function getFindings() { return sortFindings(findings) }
export function getActiveFindings() { return sortFindings(activeFindings()) }
export function getSuppressedFindings() { return sortFindings(findings.filter(f => f.suppressed)) }

function activeFindings() {
  return findings.filter(f => !f.suppressed)
}

function sortFindings(items) {
  return [...items].sort((a, b) =>
    severityRank(a.severity) - severityRank(b.severity)
    || (a.path ?? '').localeCompare(b.path ?? '')
    || (a.line ?? 0) - (b.line ?? 0)
    || a.ruleId.localeCompare(b.ruleId)
  )
}

function applySuppression(finding) {
  const suppression = (getProjectMap().rules?.suppressions ?? [])
    .find(candidate => suppressionMatches(candidate, finding))
  if (!suppression) return
  finding.suppressed = true
  finding.suppression = {
    reason: suppression.reason,
    ruleId: suppression.ruleId,
    pathPattern: suppression.pathPattern,
    expiresOn: suppression.expiresOn
  }
}

function suppressionMatches(suppression, finding) {
  if (!suppression?.reason) return false
  if (suppression.ruleId && suppression.ruleId !== finding.ruleId) return false
  if (suppression.pathPattern && !globMatches(suppression.pathPattern, finding.path ?? '')) return false
  return true
}

function globMatches(pattern, value) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR::/g, '.*')
  return new RegExp(`^${escaped}$`).test(value)
}

function severityRank(severity) {
  if (severity === 'error') return 0
  if (severity === 'warning') return 1
  return 2
}
