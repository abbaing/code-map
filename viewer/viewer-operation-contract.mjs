export function assertViewerOperations(candidate, name, operations) {
  if (!candidate || typeof candidate !== 'object') {
    throw new TypeError(`${name} must be an object`)
  }
  for (const operation of operations) {
    if (typeof candidate[operation] !== 'function') {
      throw new TypeError(`${name} must implement ${operation}()`)
    }
  }
  return candidate
}
