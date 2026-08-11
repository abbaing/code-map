import path from 'node:path'

export function createParserRegistry(parsers = []) {
  if (!Array.isArray(parsers)) {
    throw new TypeError('Parsers must be an array.')
  }
  const byId = new Map()
  const byExtension = new Map()
  for (const parser of parsers) {
    assertParser(parser)
    if (byId.has(parser.id)) {
      throw new TypeError(`Duplicate parser id: ${parser.id}.`)
    }
    byId.set(parser.id, parser)
    for (const extension of parser.extensions) {
      if (byExtension.has(extension)) {
        throw new TypeError(`Multiple parsers registered for extension: ${extension}.`)
      }
      byExtension.set(extension, parser)
    }
  }
  return Object.freeze({
    parserFor: (file) => byExtension.get(path.extname(file).toLowerCase()),
    extensions: () => Object.freeze([...byExtension.keys()]),
    parsers: () => Object.freeze([...byId.values()])
  })
}

export function createSourceDocumentStore({ parserRegistry, sourceReader }) {
  if (!parserRegistry || typeof parserRegistry.parserFor !== 'function') {
    throw new TypeError('SourceDocumentStore requires a parser registry.')
  }
  if (!sourceReader || typeof sourceReader.readText !== 'function') {
    throw new TypeError('SourceDocumentStore requires a source reader.')
  }
  const cache = new Map()

  function documentOf(file) {
    if (cache.has(file)) {
      return cache.get(file)
    }
    const parser = parserRegistry.parserFor(file)
    if (!parser) {
      return undefined
    }
    const content = sourceReader.readText(file)
    const document = Object.freeze({ parserId: parser.id, file, content, syntax: parser.parse(content, file) })
    cache.set(file, document)
    return document
  }

  function requireDocumentOf(file) {
    const document = documentOf(file)
    if (!document) {
      throw new Error(`No parser is registered for source file: ${file}`)
    }
    return document
  }

  return Object.freeze({
    documentOf,
    requireDocumentOf,
    isTest: (file) => Boolean(parserRegistry.parserFor(file)?.isTest?.(file)),
    factsOf(file, factName) {
      const parser = parserRegistry.parserFor(file)
      const document = documentOf(file)
      const fact = parser?.facts?.[factName]
      return document && fact ? fact(document) : undefined
    },
    resolveReference(file, reference, context) {
      return parserRegistry.parserFor(file)?.resolveReference?.({ file, reference, context })
    },
    extensions: () => parserRegistry.extensions()
  })
}

export function assertParser(parser) {
  if (!parser || typeof parser.id !== 'string' || parser.id.length === 0 || typeof parser.parse !== 'function') {
    throw new TypeError('Parsers must declare an id and parse(content, file).')
  }
  if (!Array.isArray(parser.extensions) || parser.extensions.length === 0) {
    throw new TypeError(`Parser ${parser.id} must declare extensions.`)
  }
  if (parser.extensions.some((extension) => !/^\.[a-z0-9]+$/u.test(extension))) {
    throw new TypeError(`Parser ${parser.id} extensions must be lowercase file extensions.`)
  }
  if (parser.facts !== undefined && (!parser.facts || typeof parser.facts !== 'object')) {
    throw new TypeError(`Parser ${parser.id} facts must be an object.`)
  }
  return parser
}
