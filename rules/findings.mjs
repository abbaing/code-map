export function createFindingCollector(projectMap) {
  const collected = []

  const sink = Object.freeze({
    add(data) {
      const finding = Object.freeze({
        id: [data.ruleId, data.nodeId, data.line ?? 0, collected.length].join(':'),
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
      })
      collected.push(finding)
      return finding
    }
  })

  const evaluated = () => collected.map((finding) => withSuppression(finding, projectMap))
  const source = Object.freeze({
    all: () => freezeFindings(sortFindings(evaluated())),
    active: () => freezeFindings(sortFindings(evaluated().filter((finding) => !finding.suppressed))),
    suppressed: () => freezeFindings(sortFindings(evaluated().filter((finding) => finding.suppressed)))
  })

  return Object.freeze({ sink, source })
}

export function attachFindingsToNodes(graph, findings) {
  const byNode = new Map()
  for (const finding of findings) {
    if (!finding.nodeId || !graph.hasNode(finding.nodeId)) {
      continue
    }
    const current = byNode.get(finding.nodeId) ?? []
    current.push(finding)
    byNode.set(finding.nodeId, current)
  }

  for (const [nodeId, nodeFindings] of byNode) {
    graph.addNode(nodeId, { meta: { findings: nodeFindings } })
  }
}

function freezeFindings(findings) {
  return Object.freeze(findings.map((finding) => Object.freeze(finding)))
}

function sortFindings(items) {
  return [...items].sort(
    (a, b) =>
      severityRank(a.severity) - severityRank(b.severity) ||
      (a.path ?? '').localeCompare(b.path ?? '') ||
      (a.line ?? 0) - (b.line ?? 0) ||
      a.ruleId.localeCompare(b.ruleId)
  )
}

function withSuppression(finding, projectMap) {
  const suppression = (projectMap.rules?.suppressions ?? []).find((candidate) => suppressionMatches(candidate, finding))
  if (!suppression) {
    return { ...finding }
  }
  return {
    ...finding,
    suppressed: true,
    suppression: Object.freeze({
      reason: suppression.reason,
      ruleId: suppression.ruleId,
      pathPattern: suppression.pathPattern,
      expiresOn: suppression.expiresOn
    })
  }
}

function suppressionMatches(suppression, finding) {
  if (!suppression?.reason) {
    return false
  }
  if (suppression.ruleId && suppression.ruleId !== finding.ruleId) {
    return false
  }
  if (suppression.pathPattern && !globMatches(suppression.pathPattern, finding.path ?? '')) {
    return false
  }
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
  if (severity === 'error') {
    return 0
  }
  if (severity === 'warning') {
    return 1
  }
  return 2
}
