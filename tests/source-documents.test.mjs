import assert from 'node:assert/strict'
import { createParserRegistry, createSourceDocumentStore } from '#core/source-documents.mjs'

let reads = 0
const parser = {
  id: 'fixture',
  extensions: ['.fixture'],
  parse: (content, file) => ({ length: content.length, file }),
  isTest: (file) => file.endsWith('.test.fixture'),
  facts: { length: (document) => document.syntax.length },
  resolveReference: ({ reference }) => `/resolved/${reference}.fixture`
}
const parserRegistry = createParserRegistry([parser])
const sourceDocuments = createSourceDocumentStore({
  parserRegistry,
  sourceReader: {
    readText() {
      reads += 1
      return 'fixture'
    }
  }
})

const first = sourceDocuments.documentOf('/source.fixture')
assert.equal(first.parserId, 'fixture')
assert.equal(sourceDocuments.documentOf('/source.fixture'), first)
assert.equal(reads, 1, 'documents must be parsed once per store')
assert.equal(sourceDocuments.factsOf('/source.fixture', 'length'), 7)
assert.equal(sourceDocuments.resolveReference('/source.fixture', 'target', {}), '/resolved/target.fixture')
assert.equal(sourceDocuments.isTest('/source.test.fixture'), true)
assert.deepEqual(sourceDocuments.extensionsFor('/source.fixture'), ['.fixture'])
assert.equal(sourceDocuments.documentOf('/source.unknown'), undefined)
assert.throws(() => sourceDocuments.requireDocumentOf('/source.unknown'), /No parser is registered/u)
assert.throws(() => createParserRegistry([parser, parser]), /Duplicate parser id/u)
assert.throws(
  () => createParserRegistry([{ ...parser, id: 'other' }, parser]),
  /Multiple parsers registered for extension/u
)

console.log('source document contract tests passed')
