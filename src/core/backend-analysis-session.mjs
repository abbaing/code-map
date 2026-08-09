function addToIndex(index, key, value) {
  const bucket = index.get(key) ?? []
  bucket.push(value)
  index.set(key, bucket)
}

export function createBackendAnalysisSession(entries = []) {
  if (!Array.isArray(entries)) {
    throw new TypeError('Backend analysis entries must be an array.')
  }
  const filesByName = new Map()
  const typesByName = new Map()
  const implementationsByInterface = new Map()

  for (const entry of entries) {
    if (
      !entry ||
      typeof entry.file !== 'string' ||
      entry.file.length === 0 ||
      typeof entry.fileName !== 'string' ||
      entry.fileName.length === 0 ||
      !Array.isArray(entry.declarations)
    ) {
      throw new TypeError('Each backend analysis entry requires a file, file name, and declarations.')
    }
    addToIndex(filesByName, entry.fileName.toLowerCase(), entry.file)
    for (const declaration of entry.declarations) {
      const indexed = Object.freeze({
        kind: declaration.kind,
        name: declaration.name,
        baseTypes: Object.freeze([...(declaration.baseTypes ?? [])]),
        file: entry.file
      })
      addToIndex(typesByName, declaration.name, indexed)
      if (declaration.kind !== 'class') {
        continue
      }
      for (const implemented of indexed.baseTypes.filter((name) => name.startsWith('I'))) {
        addToIndex(implementationsByInterface, implemented, indexed)
      }
    }
  }

  const values = (index, key) => Object.freeze([...(index.get(key) ?? [])])
  return Object.freeze({
    filesNamed: (fileName) => values(filesByName, fileName.toLowerCase()),
    declarationsNamed: (typeName) => values(typesByName, typeName),
    implementationsOf: (interfaceName) => values(implementationsByInterface, interfaceName)
  })
}
