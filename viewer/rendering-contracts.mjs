export function createLayoutRegistry(strategies) {
  const entries = validateImplementations(strategies, 'LayoutStrategy', 'layout')
  const byId = new Map(entries.map((strategy) => [strategy.id, strategy]))
  const get = (id) => {
    const strategy = byId.get(id)
    if (!strategy) {
      throw new RangeError(`Unknown layout strategy: ${id}`)
    }
    return strategy
  }

  return Object.freeze({
    ids: Object.freeze([...byId.keys()]),
    get,
    layout(id, input) {
      return get(id).layout(input)
    }
  })
}

export function createNodeRendererRegistry(renderers) {
  return createRendererRegistry(renderers, 'NodeRenderer')
}

export function createEdgeRendererRegistry(renderers) {
  return createRendererRegistry(renderers, 'EdgeRenderer')
}

export function assertLayoutStrategy(strategy) {
  return assertImplementation(strategy, 'LayoutStrategy', 'layout')
}

export function assertNodeRenderer(renderer) {
  return assertImplementation(renderer, 'NodeRenderer', 'render')
}

export function assertEdgeRenderer(renderer) {
  return assertImplementation(renderer, 'EdgeRenderer', 'render')
}

function createRendererRegistry(renderers, name) {
  const entries = validateImplementations(renderers, name, 'render')
  const byId = new Map(entries.map((renderer) => [renderer.id, renderer]))

  return Object.freeze({
    ids: Object.freeze([...byId.keys()]),
    render(id, input) {
      const renderer = byId.get(id)
      if (!renderer) {
        throw new RangeError(`Unknown ${name}: ${id}`)
      }
      return renderer.render(input)
    }
  })
}

function validateImplementations(implementations, name, operation) {
  if (!Array.isArray(implementations) || implementations.length === 0) {
    throw new TypeError(`${name} implementations must be a non-empty array`)
  }
  const ids = new Set()
  return implementations.map((implementation) => {
    assertImplementation(implementation, name, operation)
    if (ids.has(implementation.id)) {
      throw new TypeError(`Duplicate ${name} id: ${implementation.id}`)
    }
    ids.add(implementation.id)
    return Object.freeze({ id: implementation.id, [operation]: implementation[operation].bind(implementation) })
  })
}

function assertImplementation(implementation, name, operation) {
  if (!implementation || typeof implementation !== 'object') {
    throw new TypeError(`${name} must be an object`)
  }
  if (typeof implementation.id !== 'string' || implementation.id.trim().length === 0) {
    throw new TypeError(`${name} must declare an id`)
  }
  if (typeof implementation[operation] !== 'function') {
    throw new TypeError(`${name} must implement ${operation}()`)
  }
  return implementation
}
