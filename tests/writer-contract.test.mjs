import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { nodeTextWriter } from '../json-io.mjs'
import { assertTextWriter, createTextWriter } from '../writer-contract.mjs'

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'code-map-writer-'))
const memoryDocuments = new Map()
const memoryWriter = createTextWriter({
  documents: memoryDocuments,
  writeText(filePath, contents) {
    this.documents.set(filePath, contents)
    return filePath
  }
})

const implementations = [
  {
    writer: memoryWriter,
    target: 'memory://graph.json',
    read: (target) => memoryDocuments.get(target)
  },
  {
    writer: nodeTextWriter,
    target: path.join(tempRoot, 'nested', 'graph.json'),
    read: (target) => fs.readFileSync(target, 'utf8')
  }
]

try {
  for (const implementation of implementations) {
    const { writer, target, read } = implementation
    assert.equal(Object.isFrozen(writer), true)
    assert.equal(assertTextWriter(writer), writer)
    assert.equal(writer.writeText(target, '{}\n'), target)
    assert.equal(read(target), '{}\n')
  }
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true })
}

assert.throws(() => assertTextWriter(), /must implement writeText/u)
assert.throws(() => createTextWriter({ writeText: true }), /must implement writeText/u)

console.log('writer contract tests passed')
