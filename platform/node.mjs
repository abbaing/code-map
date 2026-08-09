import crypto from 'node:crypto'
import fs from 'node:fs'

export function createNodePlatform({ processRef = process } = {}) {
  const fileSystem = Object.freeze({
    exists: (filePath) => fs.existsSync(filePath),
    readText: (filePath) => fs.readFileSync(filePath, 'utf8'),
    readBytes: (filePath) => fs.readFileSync(filePath),
    readDirectory: (directory, options) => fs.readdirSync(directory, options),
    stat: (filePath) => fs.statSync(filePath),
    realPath: (filePath) => fs.realpathSync(filePath),
    remove: (filePath, options) => fs.rmSync(filePath, options)
  })
  const environment = Object.freeze({
    cwd: () => processRef.cwd(),
    args: () => [...processRef.argv],
    variable: (name) => processRef.env[name],
    exit: (code) => processRef.exit(code)
  })
  const clock = Object.freeze({
    nowIso: () => new Date().toISOString(),
    nowMilliseconds: () => Date.now()
  })
  const hash = Object.freeze({
    sha256: (value) => crypto.createHash('sha256').update(value).digest('hex')
  })
  const random = Object.freeze({
    uuid: () => crypto.randomUUID(),
    token: (bytes = 32) => crypto.randomBytes(bytes).toString('base64url'),
    timingSafeEqual: (left, right) => left.length === right.length && crypto.timingSafeEqual(left, right)
  })
  return Object.freeze({ fileSystem, environment, clock, hash, random })
}

export const nodePlatform = createNodePlatform()
