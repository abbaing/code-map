export function createElement({ bounds = { left: 0, top: 0, width: 0, height: 0 } } = {}) {
  const listeners = new Map()
  const classes = new Set()
  const capturedPointers = new Set()
  return {
    value: '',
    dataset: {},
    style: {},
    listeners,
    releasedPointers: new Set(),
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      toggle(name, force) {
        const enabled = force ?? !classes.has(name)
        if (enabled) {
          classes.add(name)
        } else {
          classes.delete(name)
        }
        return enabled
      },
      contains: (name) => classes.has(name)
    },
    addEventListener(type, listener) {
      const entries = listeners.get(type) ?? []
      entries.push(listener)
      listeners.set(type, entries)
    },
    async dispatch(type, event) {
      for (const listener of listeners.get(type) ?? []) {
        await listener(event)
      }
    },
    contains() {
      return false
    },
    getBoundingClientRect() {
      return bounds
    },
    querySelectorAll() {
      return []
    },
    setPointerCapture(id) {
      capturedPointers.add(id)
    },
    hasPointerCapture(id) {
      return capturedPointers.has(id)
    },
    releasePointerCapture(id) {
      capturedPointers.delete(id)
      this.releasedPointers.add(id)
    }
  }
}

export function eventTarget({ id, module } = {}) {
  const node = id || module ? { dataset: { id, module } } : null
  return {
    closest(selector) {
      return selector === '.node' ? node : null
    }
  }
}

export function pointerEvent(target, overrides = {}) {
  return {
    button: 0,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    target,
    preventDefault() {},
    ...overrides
  }
}
