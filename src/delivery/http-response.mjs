import fs from 'node:fs'
import path from 'node:path'
import { validateGraphDocument } from '#core/graph.mjs'

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml'
}

export function createHttpResponder(securityHeaders) {
  function headers(type, extra = {}) {
    return {
      'Content-Type': type,
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      ...extra,
      ...securityHeaders
    }
  }
  function send(response, status, body, type = 'text/plain; charset=utf-8', extra = {}) {
    response.writeHead(status, headers(type, extra))
    response.end(body)
  }
  function sendJson(response, status, body) {
    send(response, status, JSON.stringify(body), 'application/json; charset=utf-8')
  }
  function sendFile(response, filePath, extra = {}) {
    if (!fs.existsSync(filePath)) {
      return send(response, 404, 'Not found')
    }
    const type = contentTypes[path.extname(filePath)] ?? 'application/octet-stream'
    response.writeHead(200, headers(type, extra))
    response.end(fs.readFileSync(filePath))
  }
  function sendGraphFile(response, filePath) {
    if (!fs.existsSync(filePath)) {
      return send(response, 404, 'Not found')
    }
    const graph = validateGraphDocument(JSON.parse(fs.readFileSync(filePath, 'utf8')))
    sendJson(response, 200, graph)
  }
  return Object.freeze({ send, sendJson, sendFile, sendGraphFile })
}
