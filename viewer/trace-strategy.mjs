export function createTraceStrategy(implementation) {
  assertTraceStrategy(implementation)
  return Object.freeze({
    buildTrace: implementation.buildTrace.bind(implementation),
    buildModuleTrace: implementation.buildModuleTrace.bind(implementation),
    buildSystemGraph: implementation.buildSystemGraph.bind(implementation)
  })
}

export function assertTraceStrategy(strategy) {
  if (!strategy || typeof strategy !== 'object') {
    throw new TypeError('TraceStrategy must be an object')
  }
  for (const operation of ['buildTrace', 'buildModuleTrace', 'buildSystemGraph']) {
    if (typeof strategy[operation] !== 'function') {
      throw new TypeError(`TraceStrategy must implement ${operation}()`)
    }
  }
  return strategy
}
