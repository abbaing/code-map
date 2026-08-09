const routeOperations = ['matches', 'handle']

export function defineRoute(route) {
  assertRoute(route)
  return Object.freeze({
    id: route.id,
    method: route.method,
    matches: route.matches,
    handle: route.handle
  })
}

export function createRouteRegistry(routes) {
  if (!Array.isArray(routes)) {
    throw new TypeError('Route registry requires an array of routes.')
  }
  const normalized = routes.map(defineRoute)
  const ids = new Set()
  for (const route of normalized) {
    if (ids.has(route.id)) {
      throw new TypeError(`Route id must be unique: ${route.id}.`)
    }
    ids.add(route.id)
  }
  return Object.freeze({
    routes: Object.freeze(normalized),
    find(method, pathname) {
      return normalized.find((route) => route.method === method && route.matches(pathname))
    }
  })
}

export function assertRoute(route) {
  if (!route || typeof route !== 'object') {
    throw new TypeError('Route implementation is required.')
  }
  if (typeof route.id !== 'string' || !/^[a-z][a-z0-9.-]*$/u.test(route.id)) {
    throw new TypeError('Route id must use lowercase letters, numbers, dots, or hyphens.')
  }
  if (typeof route.method !== 'string' || !/^[A-Z]+$/u.test(route.method)) {
    throw new TypeError(`Route ${route.id} must declare an uppercase HTTP method.`)
  }
  for (const operation of routeOperations) {
    if (typeof route[operation] !== 'function') {
      throw new TypeError(`Route ${route.id} must implement ${operation}().`)
    }
  }
  return route
}

export function assertRouteRegistry(registry) {
  if (!registry || typeof registry !== 'object' || typeof registry.find !== 'function') {
    throw new TypeError('Route registry must implement find(method, pathname).')
  }
  return registry
}

export const routeContract = Object.freeze(['id', 'method', ...routeOperations])
