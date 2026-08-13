import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export function createFixtureTree(...fixtures) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'code-map-fixtures-'))
  for (const fixture of fixtures) {
    for (const [relativePath, content] of Object.entries(fixture)) {
      const fullPath = path.join(root, relativePath)
      fs.mkdirSync(path.dirname(fullPath), { recursive: true })
      fs.writeFileSync(fullPath, content, 'utf8')
    }
  }
  return root
}
