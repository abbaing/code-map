function assertNames(values, label, phaseId) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string' || value.length === 0)) {
    throw new TypeError(`Scan phase ${phaseId} ${label} must be an array of non-empty names.`)
  }
  if (new Set(values).size !== values.length) {
    throw new TypeError(`Scan phase ${phaseId} ${label} must not contain duplicates.`)
  }
}

export function defineScanPhase({ id, requires = [], provides = [], run } = {}) {
  if (typeof id !== 'string' || id.length === 0) {
    throw new TypeError('Scan phase id is required.')
  }
  assertNames(requires, 'requirements', id)
  assertNames(provides, 'outputs', id)
  if (typeof run !== 'function') {
    throw new TypeError(`Scan phase ${id} must implement run(input).`)
  }
  return Object.freeze({ id, requires: Object.freeze([...requires]), provides: Object.freeze([...provides]), run })
}

export function createScanPipeline(phases) {
  if (!Array.isArray(phases) || phases.length === 0) {
    throw new TypeError('A scan pipeline requires at least one phase.')
  }
  const normalized = phases.map((phase) => defineScanPhase(phase))
  const ids = new Set()
  const outputOwners = new Map()
  for (const phase of normalized) {
    if (ids.has(phase.id)) {
      throw new TypeError(`Duplicate scan phase id: ${phase.id}.`)
    }
    ids.add(phase.id)
    for (const output of phase.provides) {
      if (outputOwners.has(output)) {
        throw new TypeError(`Scan output ${output} is provided by both ${outputOwners.get(output)} and ${phase.id}.`)
      }
      outputOwners.set(output, phase.id)
    }
  }

  return Object.freeze({
    phases: Object.freeze([...normalized]),
    run(initialState = {}) {
      let state = { ...initialState }
      for (const phase of normalized) {
        const missing = phase.requires.filter((name) => !Object.hasOwn(state, name))
        if (missing.length > 0) {
          throw new Error(`Scan phase ${phase.id} is missing required input: ${missing.join(', ')}.`)
        }
        const input = Object.freeze(Object.fromEntries(phase.requires.map((name) => [name, state[name]])))
        const output = phase.run(input) ?? {}
        if (!output || typeof output !== 'object' || Array.isArray(output)) {
          throw new TypeError(`Scan phase ${phase.id} must return an output object.`)
        }
        const unexpected = Object.keys(output).filter((name) => !phase.provides.includes(name))
        if (unexpected.length > 0) {
          throw new Error(`Scan phase ${phase.id} returned undeclared output: ${unexpected.join(', ')}.`)
        }
        const absent = phase.provides.filter((name) => !Object.hasOwn(output, name))
        if (absent.length > 0) {
          throw new Error(`Scan phase ${phase.id} did not provide declared output: ${absent.join(', ')}.`)
        }
        state = { ...state, ...output }
      }
      return Object.freeze(state)
    }
  })
}
