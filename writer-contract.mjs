export function assertTextWriter(writer) {
  if (!writer || typeof writer.writeText !== 'function') {
    throw new TypeError('TextWriter must implement writeText(filePath, contents).')
  }
  return writer
}

export function createTextWriter(implementation) {
  assertTextWriter(implementation)
  return Object.freeze({
    writeText: implementation.writeText.bind(implementation)
  })
}
