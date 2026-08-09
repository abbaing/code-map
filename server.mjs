import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getConfigPathFromArgs, loadProjectContext } from '#core/config.mjs'
import { detect } from '#node/detect-node.mjs'
import { loadTemplatePlugins } from '#templates/registry.mjs'
import { ApplicationInputError, assertServerApplication, createServerApplication } from '#app/server-app.mjs'
import { nodeServerApplicationServices } from '#node/server-app-node.mjs'
import { SubmapError } from '#submap/errors.mjs'
import { nodePlatform } from '#platform/node.mjs'
import { assertRoute, assertRouteRegistry, createRouteRegistry, defineRoute } from '#core/http-routes.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const viewerRoot = path.join(__dirname, 'viewer')
const indexPath = path.join(viewerRoot, 'viewer.html')
const viewerImportMapSource = fs
  .readFileSync(indexPath, 'utf8')
  .match(/<script type="importmap">([\s\S]*?)<\/script>/u)?.[1]
if (!viewerImportMapSource) {
  throw new Error('Viewer import map is missing')
}
const viewerImportMapHash = crypto.createHash('sha256').update(viewerImportMapSource).digest('base64')
const viewerAssets = new Map(
  [
    'tailwind.css',
    'viewer.css',
    'graph-gateway.mjs',
    'rendering-contracts.mjs',
    'viewer-actions.js',
    'viewer-data.js',
    'viewer-findings.js',
    'viewer-graph.js',
    'viewer-init.js',
    'viewer-interactions.mjs',
    'viewer-layouts.js',
    'viewer-overview.js',
    'viewer-selection.js',
    'viewer-state.js',
    'viewer-store.mjs',
    'viewer-svg.js',
    'viewer-trace.js',
    'viewer-utils.js'
  ].map((file) => [`/${file}`, path.join(viewerRoot, file)])
)
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
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml'
}

const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'none'",
    `script-src 'self' 'sha256-${viewerImportMapHash}'`,
    "script-src-attr 'none'",
    "style-src 'self'",
    "style-src-elem 'self'",
    "style-src-attr 'unsafe-inline'",
    "connect-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'"
  ].join('; '),
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
}

function responseHeaders(type, headers = {}) {
  return {
    'Content-Type': type,
    'Cache-Control': 'no-store, max-age=0',
    Pragma: 'no-cache',
    ...headers,
    ...securityHeaders
  }
}

function send(response, status, body, type = 'text/plain; charset=utf-8', headers = {}) {
  response.writeHead(status, responseHeaders(type, headers))
  response.end(body)
}

function sendJson(response, status, body) {
  send(response, status, JSON.stringify(body), 'application/json; charset=utf-8')
}

function sendFile(response, filePath, headers = {}) {
  if (!fs.existsSync(filePath)) {
    return send(response, 404, 'Not found')
  }
  response.writeHead(200, responseHeaders(contentTypes[path.extname(filePath)] ?? 'application/octet-stream', headers))
  response.end(fs.readFileSync(filePath))
}

function readRequestBody(request) {
  const declaredLength = request.headers['content-length']
  if (declaredLength !== undefined) {
    if (!/^\d+$/u.test(declaredLength)) {
      throw new HttpRequestError(400, 'Invalid Content-Length header.')
    }
    if (Number(declaredLength) > maxRequestBodyBytes) {
      request.resume()
      throw new HttpRequestError(413, 'Request body exceeds the 1 MiB limit.')
    }
  }

  return new Promise((resolve, reject) => {
    const chunks = []
    let receivedBytes = 0
    let settled = false
    request.on('data', (chunk) => {
      if (settled) {
        return
      }
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
      if (settled) {
        return
      }
      settled = true
      resolve(Buffer.concat(chunks, receivedBytes).toString('utf8'))
    })
    request.on('aborted', () => {
      if (settled) {
        return
      }
      settled = true
      reject(new HttpRequestError(400, 'Request body was interrupted.'))
    })
    request.on('error', () => {
      if (settled) {
        return
      }
      settled = true
      reject(new HttpRequestError(400, 'Request body could not be read.'))
    })
  })
}

async function readJsonRequest(request) {
  const body = await readRequestBody(request)
  try {
    return JSON.parse(body)
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error
    }
    throw new HttpRequestError(400, 'Request body must contain valid JSON.')
  }
}

function handleScan(response, application) {
  const graph = application.scan()
  sendJson(response, 200, { ok: true, stats: graph.stats, generatedAt: graph.generatedAt })
}

async function handleProjectMap(request, response, application) {
  const input = await readJsonRequest(request)
  const result = application.saveProjectMap(input)
  sendJson(response, 200, { ok: true, ...result })
}

async function handleTraceSubmap(request, response, application) {
  const input = await readJsonRequest(request)
  const result = application.createTraceSubmap(input)
  sendJson(response, 200, { ok: true, ...result })
}

function sendApiError(response, error) {
  const { status, message } = publicError(error)
  if (status >= 500) {
    console.error(error)
  }
  if (status === 413) {
    response.setHeader('Connection', 'close')
  }
  sendJson(response, status, { ok: false, error: message })
}

function publicError(error) {
  if (error instanceof HttpRequestError) {
    return { status: error.status, message: error.message }
  }
  if (error instanceof ApplicationInputError) {
    return { status: 400, message: error.message }
  }
  if (error instanceof SubmapError) {
    if (error.code === 'SUBMAP_OUTPUT_EXISTS') {
      return { status: 409, message: error.message }
    }
    if (error.exitCode !== 1) {
      return { status: 400, message: error.message }
    }
  }
  return { status: 500, message: 'Internal server error.' }
}

function createRoutes(sessionToken, application) {
  return [
    defineRoute({
      id: 'viewer.index',
      method: 'GET',
      matches: (pathname) => pathname === '/',
      handle: ({ response }) => sendFile(response, indexPath, { 'Set-Cookie': sessionCookie(sessionToken) })
    }),
    defineRoute({
      id: 'viewer.graph',
      method: 'GET',
      matches: (pathname) => pathname === '/graph.json',
      handle: ({ response }) => sendFile(response, application.graphPath())
    }),
    defineRoute({
      id: 'viewer.project-map',
      method: 'GET',
      matches: (pathname) => pathname === '/project-map.json',
      handle: ({ response }) => sendJson(response, 200, application.projectMap())
    }),
    defineRoute({
      id: 'viewer.assets',
      method: 'GET',
      matches: (pathname) => viewerAssets.has(pathname),
      handle: ({ response, url }) => sendFile(response, viewerAssets.get(url.pathname))
    }),
    defineRoute({
      id: 'api.scan',
      method: 'POST',
      matches: (pathname) => pathname === '/api/scan',
      handle: ({ response }) => handleScan(response, application)
    }),
    defineRoute({
      id: 'api.project-map',
      method: 'POST',
      matches: (pathname) => pathname === '/api/project-map',
      handle: ({ request, response }) => handleProjectMap(request, response, application)
    }),
    defineRoute({
      id: 'api.trace-submap',
      method: 'POST',
      matches: (pathname) => pathname === '/api/submaps/from-trace',
      handle: ({ request, response }) => handleTraceSubmap(request, response, application)
    })
  ]
}

export function startServer(options = {}) {
  const platform = options.platform ?? nodePlatform
  const repoRoot = options.repoRoot ?? platform.environment.cwd()
  const serverPort = options.port ?? (Number(platform.environment.variable('CODE_MAP_PORT')) || 1133)
  const serverHost = options.host ?? (platform.environment.variable('CODE_MAP_HOST')?.trim() || '127.0.0.1')
  const log = options.log ?? console.log
  const sessionToken = options.sessionToken ?? platform.random.token(32)
  const application = assertServerApplication(
    options.application ??
      createServerApplication({
        projectContext: options.projectContext ?? loadProjectContext(undefined, { repoRoot, platform }),
        repoRoot,
        services: options.applicationServices ?? nodeServerApplicationServices
      })
  )
  const routeRegistry = assertRouteRegistry(
    options.routeRegistry ?? createRouteRegistry(createRoutes(sessionToken, application))
  )
  const server = http.createServer(
    {
      requestTimeout: options.requestTimeout ?? requestTimeoutMs,
      headersTimeout: options.headersTimeout ?? headersTimeoutMs,
      keepAliveTimeout: options.keepAliveTimeout ?? keepAliveTimeoutMs
    },
    async (request, response) => {
      const authority = trustedAuthority(request, serverHost, server.address())
      if (!authority) {
        return sendJson(response, 400, { ok: false, error: 'Invalid Host header.' })
      }
      const url = new URL(request.url ?? '/', authority.origin)
      if (request.method === 'POST' && !authorizedMutation(request, authority.origin, sessionToken, platform.random)) {
        return sendJson(response, 403, { ok: false, error: 'A same-origin viewer session is required.' })
      }
      try {
        const route = routeRegistry.find(request.method, url.pathname)
        if (route) {
          await assertRoute(route).handle(Object.freeze({ request, response, url, application }))
        } else {
          send(response, 404, 'Not found')
        }
      } catch (error) {
        sendApiError(response, error)
      }
    }
  )
  server.maxHeadersCount = options.maxHeadersCount ?? 100
  server.maxRequestsPerSocket = options.maxRequestsPerSocket ?? 100
  server.setTimeout(options.socketTimeout ?? socketTimeoutMs, (socket) => socket.destroy())
  server.listen(serverPort, serverHost, () => log(`Code map available at ${serverUrl(server.address())}`))
  return server
}

function serverUrl(address) {
  if (typeof address === 'string') {
    return address
  }
  const addressHost = address.address.includes(':') ? `[${address.address}]` : address.address
  return `http://${addressHost}:${address.port}`
}

function trustedAuthority(request, serverHost, address) {
  if (!request.headers.host || typeof address === 'string') {
    return null
  }
  let authority
  try {
    authority = new URL(`http://${request.headers.host}`)
  } catch {
    return null
  }
  if (authority.username || authority.password || authority.pathname !== '/' || authority.search || authority.hash) {
    return null
  }
  const expectedPort = address.port
  const requestPort = authority.port ? Number(authority.port) : 80
  if (requestPort !== expectedPort) {
    return null
  }

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

function authorizedMutation(request, expectedOrigin, sessionToken, random) {
  if (request.headers.origin !== expectedOrigin) {
    return false
  }
  const token = cookieValue(request.headers.cookie, sessionCookieName)
  if (!token) {
    return false
  }
  const expected = Buffer.from(sessionToken)
  const actual = Buffer.from(token)
  return random.timingSafeEqual(actual, expected)
}

function normalizeHost(value = '') {
  const normalized = String(value)
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
  return normalized.startsWith('::ffff:') ? normalized.slice('::ffff:'.length) : normalized
}

function isLoopbackHost(value) {
  return value === 'localhost' || value === '127.0.0.1' || value === '::1'
}

function cookieValue(header = '', name) {
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0 || part.slice(0, separator).trim() !== name) {
      continue
    }
    return part.slice(separator + 1).trim()
  }
  return null
}

function sessionCookie(sessionToken) {
  return `${sessionCookieName}=${sessionToken}; HttpOnly; SameSite=Strict; Path=/`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { environment, fileSystem } = nodePlatform
  const argv = environment.args()
  const repoRoot = environment.cwd()
  const configPath = getConfigPathFromArgs(argv, {
    cwd: repoRoot,
    configPath: environment.variable('CODE_MAP_CONFIG'),
    fileSystem
  })
  const projectContext = loadProjectContext(configPath ?? detect(repoRoot, { fileSystem }), {
    repoRoot,
    platform: nodePlatform
  })
  await loadTemplatePlugins(projectContext.projectMap, configPath ?? path.join(repoRoot, 'project-map.json'), {
    allow: argv.includes('--allow-plugins')
  })
  const application = createServerApplication({
    projectContext,
    repoRoot,
    services: nodeServerApplicationServices
  })
  application.scan()
  startServer({ application, projectContext })
}
