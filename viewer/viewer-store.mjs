export function createViewerStore(initialState = {}) {
  assertState(initialState)
  const currentState = clone(initialState)
  const listeners = new Set()

  return Object.freeze({
    state: currentState,
    getState() {
      return clone(currentState)
    },
    update(change) {
      const patch = typeof change === 'function' ? change(clone(currentState)) : change
      assertState(patch)
      Object.assign(currentState, clone(patch))
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

function assertState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new TypeError('ViewerStore state must be an object')
  }
}

function clone(value) {
  return structuredClone(value)
}
