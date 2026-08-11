export function createBackendDeclarationIndex(entries) {
  const indexes = { files: new Map(), types: new Map(), implementations: new Map() }
  for (const entry of entries) {
    indexEntry(indexes, validateEntry(entry))
  }
  return Object.freeze({
    filesNamed: (name) => values(indexes.files, name.toLowerCase()),
    declarationsNamed: (name) => values(indexes.types, name),
    implementationsOf: (name) => values(indexes.implementations, name)
  })
}

function validateEntry(entry) {
  const valid =
    entry &&
    typeof entry.file === 'string' &&
    entry.file.length > 0 &&
    typeof entry.fileName === 'string' &&
    entry.fileName.length > 0 &&
    Array.isArray(entry.declarations)
  if (!valid) {
    throw new TypeError('Each backend analysis entry requires a file, file name, and declarations.')
  }
  return entry
}

function indexEntry(indexes, entry) {
  add(indexes.files, entry.fileName.toLowerCase(), entry.file)
  for (const declaration of entry.declarations) {
    indexDeclaration(indexes, entry.file, declaration)
  }
}

function indexDeclaration(indexes, file, declaration) {
  const indexed = Object.freeze({
    kind: declaration.kind,
    name: declaration.name,
    baseTypes: Object.freeze([...(declaration.baseTypes ?? [])]),
    file
  })
  add(indexes.types, declaration.name, indexed)
  if (declaration.kind !== 'class') {
    return
  }
  for (const name of indexed.baseTypes.filter((baseType) => baseType.startsWith('I'))) {
    add(indexes.implementations, name, indexed)
  }
}

function add(index, key, value) {
  const bucket = index.get(key) ?? []
  bucket.push(value)
  index.set(key, bucket)
}
function values(index, key) {
  return Object.freeze([...(index.get(key) ?? [])])
}
