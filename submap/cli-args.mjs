import { SubmapError } from './errors.mjs'

const BOOLEAN_OPTIONS = new Set(['stdout', 'quiet', 'force', 'json', 'json-errors', 'non-interactive', 'help'])

export function parseArgs(args) {
  const result = { positionals: [] }
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (!token.startsWith('--')) {
      result.positionals.push(token)
      continue
    }
    const name = token.slice(2)
    if (BOOLEAN_OPTIONS.has(name)) {
      result[name] = true
      continue
    }
    const value = args[index + 1]
    if (value === undefined || value.startsWith('--')) {
      throw new SubmapError('SUBMAP_OPTION_VALUE_REQUIRED', `--${name} requires a value.`, { option: name })
    }
    ;(result[name] ??= []).push(value)
    index += 1
  }
  return result
}

export function assertOnlyOptions(options, allowed) {
  for (const name of Object.keys(options)) {
    if (name === 'positionals') {
      continue
    }
    if (!allowed.has(name)) {
      throw new SubmapError('SUBMAP_UNKNOWN_OPTION', `Unknown option: --${name}`, { option: name })
    }
  }
}

export function createOptionNames() {
  const names = new Set([
    'spec',
    'graph',
    'config',
    'output',
    'dir',
    'direction',
    'depth',
    'edge',
    'exclude-edge',
    'revision',
    'parent',
    'access-default',
    'stdout',
    'quiet',
    'force',
    'json-errors',
    'non-interactive'
  ])
  for (const prefix of ['', 'exclude-']) {
    for (const kind of ['node', 'path', 'module', 'layer', 'type']) {
      names.add(`${prefix}${kind}`)
    }
  }
  for (const level of ['editable', 'readable', 'external', 'forbidden', 'generated']) {
    for (const kind of ['node', 'path', 'module', 'layer', 'type']) {
      names.add(`${level}-${kind}`)
    }
  }
  return names
}

export function requiredPositional(options, index, code, message) {
  const value = options.positionals[index]
  if (!value) {
    throw new SubmapError(code, message)
  }
  return value
}

export function values(options, name) {
  return options[name] ?? []
}
export function last(values) {
  return values?.[values.length - 1]
}
export function scalar(options, name) {
  return last(options[name])
}

export function integerOption(options, name) {
  const raw = scalar(options, name)
  if (raw === undefined) {
    return undefined
  }
  if (!/^\d+$/.test(raw)) {
    throw new SubmapError('SUBMAP_INVALID_NUMBER', `--${name} must be an integer.`, { option: name, value: raw })
  }
  return Number(raw)
}
