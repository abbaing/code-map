export function createSourceClassifier(strategies) {
  if (!Array.isArray(strategies) || strategies.length === 0) {
    throw new TypeError('SourceClassifier strategies must be a non-empty array.')
  }
  const ordered = validateStrategies(strategies)
  return Object.freeze({ classify: (repoPath, context) => classify(ordered, repoPath, context) })
}

function validateStrategies(strategies) {
  const ids = new Set()
  return strategies.map((strategy) => {
    if (!strategy || typeof strategy.id !== 'string' || typeof strategy.classify !== 'function') {
      throw new TypeError('SourceClassifier strategies must declare id and classify(path, context).')
    }
    if (ids.has(strategy.id)) {
      throw new TypeError(`Duplicate SourceClassifier strategy id: ${strategy.id}.`)
    }
    ids.add(strategy.id)
    return Object.freeze({ id: strategy.id, classify: strategy.classify.bind(strategy) })
  })
}

function classify(strategies, repoPath, context) {
  for (const strategy of strategies) {
    const result = strategy.classify(repoPath, context)
    if (result === null || result === undefined) {
      continue
    }
    validateResult(result, strategy.id)
    return result
  }
  throw new Error(`SourceClassifier did not classify ${repoPath}.`)
}

function validateResult(result, id) {
  if (!Array.isArray(result) || result.length !== 2 || result.some((value) => typeof value !== 'string')) {
    throw new TypeError(`SourceClassifier strategy ${id} returned an invalid classification.`)
  }
}
