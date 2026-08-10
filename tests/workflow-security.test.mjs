import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workflowDirectory = path.join(root, '.github', 'workflows')
const workflowFiles = fs
  .readdirSync(workflowDirectory)
  .filter((name) => /\.ya?ml$/u.test(name))
  .sort()

assert.equal(workflowFiles.length > 0, true, 'at least one CI workflow must be present')

for (const name of workflowFiles) {
  const source = fs.readFileSync(path.join(workflowDirectory, name), 'utf8')
  const actions = [...source.matchAll(/^\s*uses:\s*([^@\s]+)@([^\s#]+)(?:\s+#\s*(\S+))?/gmu)]
  for (const [, action, revision, release] of actions) {
    assert.match(revision, /^[a-f0-9]{40}$/u, `${name}: ${action} must use an immutable commit SHA`)
    assert.match(release ?? '', /^v\d+(?:\.\d+){2}$/u, `${name}: ${action} must retain its reviewed release tag`)
  }
}

const ciSource = fs.readFileSync(path.join(workflowDirectory, 'ci.yml'), 'utf8')
assert.match(ciSource, /^permissions:\r?\n\s+contents: read$/mu, 'CI must retain read-only repository permissions')
assert.match(ciSource, /run: npm run audit:dependencies/u, 'CI must audit installed dependencies')
const packageDocument = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
assert.equal(
  packageDocument.scripts['audit:dependencies'],
  'npm audit --audit-level=high && npm audit signatures',
  'the dependency audit must check high-severity advisories and registry signatures'
)

console.log('workflow security contract tests passed')
