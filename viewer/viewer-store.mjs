export function createViewerStore(initialState = {}) {
  assertState(initialState)
  let currentState = clone(initialState)
  const listeners = new Set()

  return Object.freeze({
    getState() {
      return clone(currentState)
    },
    update(change) {
      const patch = typeof change === 'function' ? change(clone(currentState)) : change
      assertState(patch)
      currentState = { ...currentState, ...clone(patch) }
      const snapshot = clone(currentState)
      for (const listener of listeners) {
        listener(clone(snapshot))
      }
      return snapshot
    },
    subscribe(listener) {
      if (typeof listener !== 'function') {
        throw new TypeError('ViewerStore listener must be a function')
      }
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  })
}

export function assertViewerStore(store) {
  assertOperations(store, 'ViewerStore', ['getState', 'update', 'subscribe'])
  return store
}

function assertState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new TypeError('ViewerStore state must be an object')
  }
}

function assertOperations(candidate, name, operations) {
  if (!candidate || typeof candidate !== 'object') {
    throw new TypeError(`${name} must be an object`)
  }
  for (const operation of operations) {
    if (typeof candidate[operation] !== 'function') {
      throw new TypeError(`${name} must implement ${operation}()`)
    }
  }
}

function clone(value) {
  return structuredClone(value)
}
