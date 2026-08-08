import fs from 'node:fs'
import path from 'node:path'
import { writeJsonFileAtomic } from '../json-io.mjs'
import { SubmapError } from './errors.mjs'

export function readJson(filePath, kind = 'JSON document') {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    const code = error.code === 'ENOENT' ? 'SUBMAP_FILE_NOT_FOUND' : 'SUBMAP_INVALID_JSON'
    const exitCode = error.code === 'ENOENT' ? 3 : 2
    throw new SubmapError(code, `Unable to read ${kind}: ${error.message}`, { path: filePath }, exitCode)
  }
}

export function readJsonStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'))
  } catch (error) {
    throw new SubmapError('SUBMAP_INVALID_STDIN', `Unable to read JSON from stdin: ${error.message}`)
  }
}

export function readGraph(filePath) {
  return readJson(filePath, 'source graph')
}

export function readSubmap(filePath) {
  return readJson(filePath, 'submap')
}

export function writeSubmap(filePath, submap, options = {}) {
  return writeJsonAtomic(filePath, submap, options)
}

export function writeJsonAtomic(filePath, value, options = {}) {
  const resolved = path.resolve(filePath)
  if (fs.existsSync(resolved) && !options.force) {
    throw new SubmapError('SUBMAP_OUTPUT_EXISTS', 'Output file already exists.', { path: resolved }, 6)
  }
  return writeJsonFileAtomic(resolved, value)
}

export function defaultSubmapFilename(submap) {
  return `${submap.id}@${submap.uid.slice('sha256:'.length, 'sha256:'.length + 8)}.submap.json`
}

export function listSubmapFiles(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.submap.json'))
    .map(entry => path.join(directory, entry.name))
    .sort()
}
