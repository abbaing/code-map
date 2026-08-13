import assert from 'node:assert/strict'
import { mergeCatalogEntriesById } from '#core/catalog-entries.mjs'

assert.deepEqual(mergeCatalogEntriesById(), [], 'missing catalogs must merge as empty catalogs')

const left = [
  { id: 'application', label: 'Application', color: '#111111' },
  { id: 'domain', label: 'Domain', color: '#222222' }
]
const right = [
  { id: 'application', label: 'Use cases' },
  { id: 'infrastructure', label: 'Infrastructure', color: '#333333' }
]

assert.deepEqual(
  mergeCatalogEntriesById(left, right),
  [
    { id: 'application', label: 'Use cases', color: '#111111' },
    { id: 'domain', label: 'Domain', color: '#222222' },
    { id: 'infrastructure', label: 'Infrastructure', color: '#333333' }
  ],
  'later entries must override fields without changing existing catalog order'
)
assert.deepEqual(
  left,
  [
    { id: 'application', label: 'Application', color: '#111111' },
    { id: 'domain', label: 'Domain', color: '#222222' }
  ],
  'catalog merging must not mutate the left input'
)
assert.deepEqual(
  right,
  [
    { id: 'application', label: 'Use cases' },
    { id: 'infrastructure', label: 'Infrastructure', color: '#333333' }
  ],
  'catalog merging must not mutate the right input'
)

console.log('catalog entry merge tests passed')
