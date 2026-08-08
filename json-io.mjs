import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export function writeJsonFileAtomic(filePath, value) {
  const resolved = path.resolve(filePath)
  const document = `${JSON.stringify(value, null, 2)}\n`
  const directory = path.dirname(resolved)
  const tempPath = path.join(directory, `.${path.basename(resolved)}.${process.pid}.${crypto.randomUUID()}.tmp`)
  let descriptor

  fs.mkdirSync(directory, { recursive: true })
  try {
    descriptor = fs.openSync(tempPath, 'wx')
    fs.writeFileSync(descriptor, document, 'utf8')
    fs.fsyncSync(descriptor)
    fs.closeSync(descriptor)
    descriptor = undefined
    fs.renameSync(tempPath, resolved)
  } finally {
    try {
      if (descriptor !== undefined) fs.closeSync(descriptor)
    } finally {
      if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { force: true })
    }
  }

  return resolved
}
