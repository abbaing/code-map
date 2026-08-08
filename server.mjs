import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getConfigPathFromArgs, getProjectMap, loadProjectMap } from './config.mjs'
import { detect } from './detect.mjs'
import { loadTemplatePlugins } from './templates/registry.mjs'
import { ApplicationInputError, createServerApplication } from './server-app.mjs'
import { SubmapError } from './submap/errors.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = process.cwd()
const viewerRoot = path.join(__dirname, 'viewer')
const indexPath = path.join(viewerRoot, 'viewer.html')
const port = Number(process.env.CODE_MAP_PORT) || 1133
const host = process.env.CODE_MAP_HOST?.trim() || '127.0.0.1'
const application = createServerApplication({ repoRoot })
const sessionCookieName = 'code-map-session'
const maxRequestBodyBytes = 1024 * 1024
const requestTimeoutMs = 30_000
const headersTimeoutMs = 10_000
const keepAliveTimeoutMs = 5_000
const socketTimeoutMs = 30_000

class HttpRequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml'
}

function send(response, status, body, type = 'text/plain; charset=utf-8', headers = {}) {
  response.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store, max-age=0',
    'Pragma': 'no-cache',
    ...headers
  })
  response.end(body)
}

function sendJson(response, status, body) {
  send(response, status, JSON.stringify(body), 'application/json; charset=utf-8')
}

function sendFile(response, filePath, headers = {}) {
  if (!fs.existsSync(filePath)) return send(response, 404, 'Not found')
  response.writeHead(200, {
    'Content-Type': contentTypes[path.extname(filePath)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store, max-age=0',
    'Pragma': 'no-cache',
    ...headers
  })
  response.end(fs.readFileSync(filePath))
}

function readRequestBody(request) {
  const declaredLength = request.headers['content-length']
  if (declaredLength !== undefined) {
    if (!/^\d+$/u.test(declaredLength)) throw new HttpRequestError(400, 'Invalid Content-Length header.')
    if (Number(declaredLength) > maxRequestBodyBytes) {
      request.resume()
      throw new HttpRequestError(413, 'Request body exceeds the 1 MiB limit.')
    }
  }

  return new Promise((resolve, reject) => {
    const chunks = []
    let receivedBytes = 0
    let settled = false
    request.on('data', chunk => {
      if (settled) return
      receivedBytes += chunk.length
      if (receivedBytes > maxRequestBodyBytes) {
        settled = true
        chunks.length = 0
        reject(new HttpRequestError(413, 'Request body exceeds the 1 MiB limit.'))
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      if (settled) return
      settled = true
      resolve(Buffer.concat(chunks, receivedBytes).toString('utf8'))
    })
    request.on('aborted', () => {
      if (settled) return
      settled = true
      reject(new HttpRequestError(400, 'Request body was interrupted.'))
    })
    request.on('error', () => {
      if (settled) return
      settled = true
      reject(new HttpRequestError(400, 'Request body could not be read.'))
    })
  })
}

async function handleScan(request, response) {
  try {
    const graph = application.scan()
    sendJson(response, 200, { ok: true, stats: graph.stats, generatedAt: graph.generatedAt })
  } catch (error) {
    sendApiError(response, error)
  }
}

async function handleProjectMap(request, response) {
  try {
    const input = JSON.parse(await readRequestBody(request))
    const result = application.saveProjectMap(input)
    sendJson(response, 200, { ok: true, ...result })
  } catch (error) {
    sendApiError(response, error)
  }
}

async function handleTraceSubmap(request, response) {
  try {
    const input = JSON.parse(await readRequestBody(request))
    const result = application.createTraceSubmap(input)
    sendJson(response, 200, { ok: true, ...result })
  } catch (error) {
    sendApiError(response, error)
  }
}

function sendApiError(response, error) {
  const { status, message } = publicError(error)
  if (status >= 500) console.error(error)
  if (status === 413) response.setHeader('Connection', 'close')
  sendJson(response, status, { ok: false, error: message })
}

function publicError(error) {
  if (error instanceof HttpRequestError) return { status: error.status, message: error.message }
  if (error instanceof SyntaxError || error instanceof ApplicationInputError) return { status: 400, message: error.message }
  if (error instanceof SubmapError) {
    if (error.code === 'SUBMAP_OUTPUT_EXISTS') return { status: 409, message: error.message }
    if (error.exitCode !== 1) return { status: 400, message: error.message }
  }
  return { status: 500, message: 'Internal server error.' }
}

function isViewerAsset(pathname) {
  return pathname === '/tailwind.css' || pathname === '/viewer.css' || (pathname.startsWith('/viewer-') && pathname.endsWith('.js'))
}

function createRoutes(sessionToken) {
  return [
    { method: 'GET', test: pathname => pathname === '/', handler: (request, response) => sendFile(response, indexPath, { 'Set-Cookie': sessionCookie(sessionToken) }) },
    { method: 'GET', test: pathname => pathname === '/graph.json', handler: (request, response) => sendFile(response, application.graphPath()) },
    { method: 'GET', test: pathname => pathname === '/project-map.json', handler: (request, response) => sendJson(response, 200, application.projectMap()) },
    { method: 'GET', test: isViewerAsset, handler: (request, response, url) => sendFile(response, path.join(viewerRoot, url.pathname.slice(1))) },
    { method: 'POST', test: pathname => pathname === '/api/scan', handler: handleScan },
    { method: 'POST', test: pathname => pathname === '/api/project-map', handler: handleProjectMap },
    { method: 'POST', test: pathname => pathname === '/api/submaps/from-trace', handler: handleTraceSubmap }
  ]
}

export function startServer(options = {}) {
  const serverPort = options.port ?? port
  const serverHost = options.host ?? host
  const log = options.log ?? console.log
  const sessionToken = options.sessionToken ?? crypto.randomBytes(32).toString('base64url')
  const routes = createRoutes(sessionToken)
  const server = http.createServer({
    requestTimeout: options.requestTimeout ?? requestTimeoutMs,
    headersTimeout: options.headersTimeout ?? headersTimeoutMs,
    keepAliveTimeout: options.keepAliveTimeout ?? keepAliveTimeoutMs
  }, (request, response) => {
    const authority = trustedAuthority(request, serverHost, server.address())
    if (!authority) return sendJson(response, 400, { ok: false, error: 'Invalid Host header.' })
    const url = new URL(request.url ?? '/', authority.origin)
    if (request.method === 'POST' && !authorizedMutation(request, authority.origin, sessionToken)) {
      return sendJson(response, 403, { ok: false, error: 'A same-origin viewer session is required.' })
    }
    const route = routes.find(candidate => candidate.method === request.method && candidate.test(url.pathname))
    if (route) route.handler(request, response, url)
    else send(response, 404, 'Not found')
  })
  server.maxHeadersCount = options.maxHeadersCount ?? 100
  server.maxRequestsPerSocket = options.maxRequestsPerSocket ?? 100
  server.setTimeout(options.socketTimeout ?? socketTimeoutMs, socket => socket.destroy())
  server.listen(serverPort, serverHost, () => log(`Code map available at ${serverUrl(server.address())}`))
  return server
}

function serverUrl(address) {
  if (typeof address === 'string') return address
  const addressHost = address.address.includes(':') ? `[${address.address}]` : address.address
  return `http://${addressHost}:${address.port}`
}

function trustedAuthority(request, serverHost, address) {
  if (!request.headers.host || typeof address === 'string') return null
  let authority
  try {
    authority = new URL(`http://${request.headers.host}`)
  } catch {
    return null
  }
  if (authority.username || authority.password || authority.pathname !== '/' || authority.search || authority.hash) return null
  const expectedPort = address.port
  const requestPort = authority.port ? Number(authority.port) : 80
  if (requestPort !== expectedPort) return null

  const allowedHosts = new Set([
    normalizeHost(serverHost),
    normalizeHost(address.address),
    normalizeHost(request.socket.localAddress)
  ])
  if ([...allowedHosts].some(isLoopbackHost)) {
    allowedHosts.add('localhost')
    allowedHosts.add('127.0.0.1')
    allowedHosts.add('::1')
  }
  return allowedHosts.has(normalizeHost(authority.hostname)) ? authority : null
}

function authorizedMutation(request, expectedOrigin, sessionToken) {
  if (request.headers.origin !== expectedOrigin) return false
  const token = cookieValue(request.headers.cookie, sessionCookieName)
  if (!token) return false
  const expected = Buffer.from(sessionToken)
  const actual = Buffer.from(token)
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

function normalizeHost(value = '') {
  const normalized = String(value).toLowerCase().replace(/^\[|\]$/g, '')
  return normalized.startsWith('::ffff:') ? normalized.slice('::ffff:'.length) : normalized
}

function isLoopbackHost(value) {
  return value === 'localhost' || value === '127.0.0.1' || value === '::1'
}

function cookieValue(header = '', name) {
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue
    return part.slice(separator + 1).trim()
  }
  return null
}

function sessionCookie(sessionToken) {
  return `${sessionCookieName}=${sessionToken}; HttpOnly; SameSite=Strict; Path=/`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const configPath = getConfigPathFromArgs()
  if (configPath) loadProjectMap(configPath)
  else loadProjectMap(detect(repoRoot))
  await loadTemplatePlugins(getProjectMap(), configPath ?? path.join(repoRoot, 'project-map.json'))
  application.scan()
  startServer()
}
