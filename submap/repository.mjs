const requiredOperations = ['read', 'list', 'write']

export function assertSubmapRepository(repository) {
  if (!repository || typeof repository !== 'object') {
    throw new TypeError('A submap repository implementation is required.')
  }
  for (const operation of requiredOperations) {
    if (typeof repository[operation] !== 'function') {
      throw new TypeError(`Submap repository must implement ${operation}().`)
    }
  }
  return repository
}

export const submapRepositoryContract = Object.freeze([...requiredOperations])
