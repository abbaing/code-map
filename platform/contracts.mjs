const requiredOperations = {
  fileSystem: ['exists', 'readText', 'readBytes', 'readDirectory', 'stat', 'realPath', 'remove'],
  environment: ['cwd', 'args', 'variable', 'exit'],
  clock: ['nowIso', 'nowMilliseconds'],
  hash: ['sha256'],
  random: ['uuid', 'token', 'timingSafeEqual']
}

export function assertPlatform(platform) {
  if (!platform || typeof platform !== 'object') {
    throw new TypeError('A platform implementation is required.')
  }
  for (const [capability, operations] of Object.entries(requiredOperations)) {
    const implementation = platform[capability]
    if (!implementation || typeof implementation !== 'object') {
      throw new TypeError(`Platform capability ${capability} is required.`)
    }
    for (const operation of operations) {
      if (typeof implementation[operation] !== 'function') {
        throw new TypeError(`Platform capability ${capability} must implement ${operation}().`)
      }
    }
  }
  return platform
}

export const platformContract = Object.freeze(
  Object.fromEntries(
    Object.entries(requiredOperations).map(([name, operations]) => [name, Object.freeze([...operations])])
  )
)
