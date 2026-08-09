export function createViewController(implementation) {
  assertViewController(implementation)
  return Object.freeze({
    id: implementation.id,
    bind: implementation.bind.bind(implementation),
    render: implementation.render.bind(implementation)
  })
}

export function createViewControllerRegistry(controllers) {
  if (!Array.isArray(controllers) || controllers.length === 0) {
    throw new TypeError('ViewController implementations must be a non-empty array')
  }
  const byId = new Map()
  for (const implementation of controllers) {
    const controller = createViewController(implementation)
    if (byId.has(controller.id)) {
      throw new TypeError(`Duplicate ViewController id: ${controller.id}`)
    }
    byId.set(controller.id, controller)
  }
  const get = (id) => {
    const controller = byId.get(id)
    if (!controller) {
      throw new RangeError(`Unknown view controller: ${id}`)
    }
    return controller
  }

  return Object.freeze({
    ids: Object.freeze([...byId.keys()]),
    get,
    bindAll(context) {
      return [...byId.values()].map((controller) => controller.bind(context))
    },
    render(id, model) {
      return get(id).render(model)
    }
  })
}

export function assertViewController(controller) {
  if (!controller || typeof controller !== 'object') {
    throw new TypeError('ViewController must be an object')
  }
  if (typeof controller.id !== 'string' || controller.id.trim().length === 0) {
    throw new TypeError('ViewController must declare an id')
  }
  for (const operation of ['bind', 'render']) {
    if (typeof controller[operation] !== 'function') {
      throw new TypeError(`ViewController must implement ${operation}()`)
    }
  }
  return controller
}
