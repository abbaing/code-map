const commandOperations = ['matches', 'execute']

export function defineCommand(command) {
  assertCommand(command)
  return Object.freeze({ id: command.id, matches: command.matches, execute: command.execute })
}

export function createCommandRegistry(commands) {
  if (!Array.isArray(commands) || commands.length === 0) {
    throw new TypeError('Command registry requires at least one command.')
  }
  const normalized = commands.map(defineCommand)
  const ids = new Set()
  for (const command of normalized) {
    if (ids.has(command.id)) {
      throw new TypeError(`Command id must be unique: ${command.id}.`)
    }
    ids.add(command.id)
  }
  return Object.freeze({
    commands: Object.freeze(normalized),
    resolve(input) {
      return normalized.find((command) => command.matches(input))
    },
    async execute(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new TypeError('Command input must be an object.')
      }
      const commandInput = Object.freeze({ ...input })
      const command = normalized.find((candidate) => candidate.matches(commandInput))
      if (!command) {
        throw new TypeError('No command matched the provided input.')
      }
      const result = await command.execute(commandInput)
      if (
        !result ||
        typeof result !== 'object' ||
        (result.exitCode !== null &&
          (!Number.isInteger(result.exitCode) || result.exitCode < 0 || result.exitCode > 255))
      ) {
        throw new TypeError(`Command ${command.id} must return an exitCode between 0 and 255, or null.`)
      }
      return Object.freeze({ commandId: command.id, exitCode: result.exitCode })
    }
  })
}

export function assertCommand(command) {
  if (!command || typeof command !== 'object') {
    throw new TypeError('Command implementation is required.')
  }
  if (typeof command.id !== 'string' || !/^[a-z][a-z0-9.-]*$/u.test(command.id)) {
    throw new TypeError('Command id must use lowercase letters, numbers, dots, or hyphens.')
  }
  for (const operation of commandOperations) {
    if (typeof command[operation] !== 'function') {
      throw new TypeError(`Command ${command.id} must implement ${operation}().`)
    }
  }
  return command
}

export function assertCommandRegistry(registry) {
  if (!registry || typeof registry !== 'object' || typeof registry.resolve !== 'function') {
    throw new TypeError('Command registry must implement resolve(input).')
  }
  if (typeof registry.execute !== 'function') {
    throw new TypeError('Command registry must implement execute(input).')
  }
  return registry
}

export const commandContract = Object.freeze(['id', ...commandOperations])
