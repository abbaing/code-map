export function shortestTracePath(startId, adjacency, nodeById, isTarget, preferredTokens = []) {
  const queue = [{ id: startId, cost: 0 }]
  const costs = new Map([[startId, 0]])
  const previous = new Map()
  const targetId = findTarget({ queue, costs, previous, adjacency, nodeById, isTarget, preferredTokens })
  return targetId ? restorePath(startId, targetId, previous) : { nodes: [startId], edges: [], found: false }
}

export function traceSearchTokens(node) {
  return `${node.label ?? ''}`
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(
      (token) =>
        (token.length >= 4 || token === 'new') &&
        !['index', 'component', 'components', 'feature', 'main'].includes(token)
    )
}

function findTarget(context) {
  while (context.queue.length) {
    context.queue.sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id))
    const current = context.queue.shift()
    if (current.cost !== context.costs.get(current.id)) {
      continue
    }
    if (context.isTarget(context.nodeById.get(current.id))) {
      return current.id
    }
    visitSteps(current, context)
  }
  return null
}

function visitSteps(current, context) {
  for (const step of context.adjacency.get(current.id) ?? []) {
    const nextNode = context.nodeById.get(step.nodeId)
    const nextCost =
      current.cost +
      Math.max(0.25, traceEdgeWeight(step.edge, context.nodeById) - semanticBoost(nextNode, context.preferredTokens)) +
      intentPenalty(nextNode, context.preferredTokens)
    if (nextCost >= (context.costs.get(step.nodeId) ?? Infinity)) {
      continue
    }
    context.costs.set(step.nodeId, nextCost)
    context.previous.set(step.nodeId, { nodeId: current.id, edgeId: step.edge.id })
    context.queue.push({ id: step.nodeId, cost: nextCost })
  }
}

function restorePath(startId, targetId, previous) {
  const nodes = [targetId]
  const edges = []
  while (nodes.at(-1) !== startId) {
    const step = previous.get(nodes.at(-1))
    if (!step) {
      break
    }
    edges.push(step.edgeId)
    nodes.push(step.nodeId)
  }
  return { nodes: nodes.reverse(), edges: edges.reverse(), found: true }
}

function intentPenalty(node, tokens) {
  if (node?.type !== 'endpoint' || !node.meta?.backend?.action) {
    return 0
  }
  const tokenSet = new Set(tokens)
  const action = node.meta.backend.action.toLowerCase()
  const method = node.meta.method
  for (const rule of intentRules(method)) {
    if (rule.tokens.some((token) => tokenSet.has(token))) {
      return rule.matches(action) ? 0 : rule.penalty
    }
  }
  return 0
}

function semanticBoost(node, tokens) {
  if (!node || tokens.length === 0) {
    return 0
  }
  if (!['endpoint', 'query', 'command', 'handler', 'repository', 'entity', 'table'].includes(node.type)) {
    return 0
  }
  const label = semanticLabel(node)
  const words = semanticWords(label)
  const normalizedTokens = new Set(tokens.map(singular))
  if (allWordsMatch(words, normalizedTokens)) {
    return 1.75
  }
  const haystack = `${label} ${node.path ?? ''}`.toLowerCase()
  return tokens.some((token) => haystack.includes(token)) ? 0.75 : 0
}

function intentRules(method) {
  return [
    { tokens: ['create', 'new'], matches: (action) => /create|add/.test(action), penalty: 8 },
    { tokens: ['edit', 'update'], matches: (action) => /update|edit|save|set/.test(action), penalty: 8 },
    { tokens: ['list'], matches: (action) => /list|search|getall/.test(action) || method === 'GET', penalty: 6 },
    { tokens: ['detail', 'view'], matches: (action) => /get|detail|byid/.test(action) || method === 'GET', penalty: 4 }
  ]
}

function semanticLabel(node) {
  return node.type === 'endpoint' && node.meta?.backend?.action ? node.meta.backend.action : (node.label ?? '')
}

function allWordsMatch(words, tokens) {
  return words.length > 0 && words.every((word) => tokens.has(word))
}

function semanticWords(label) {
  return label
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(singular)
    .filter(
      (word) =>
        word.length >= 4 && !['command', 'query', 'handler', 'repository', 'controller', 'endpoint'].includes(word)
    )
}

function singular(word) {
  return word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word
}

function traceEdgeWeight(edge, nodeById) {
  const confidencePenalty = edge.confidence === 'high' ? 0 : edge.confidence === 'medium' ? 1 : 3
  const persistenceAdapter = nodeById.get(edge.from)?.type === 'repository'
  const shortcutPenalty =
    edge.type === 'queries-table' ? (persistenceAdapter ? 2 : 8) : entityPenalty(edge, persistenceAdapter)
  return 1 + confidencePenalty + shortcutPenalty
}

function entityPenalty(edge, persistenceAdapter) {
  return edge.type === 'uses-entity' && !persistenceAdapter ? 4 : 0
}
