import http from 'node:http'
import { assertRoute } from '#core/http-routes.mjs'
import { authorizedMutation, trustedAuthority } from '#entry/src/delivery/http-security.mjs'
import { sendApiError } from '#entry/src/delivery/http-routes.mjs'

const defaults = { requestTimeout: 30_000, headersTimeout: 10_000, keepAliveTimeout: 5_000, socketTimeout: 30_000 }

export function createHttpServer(options) {
  const { platform, serverHost, sessionToken, application, routeRegistry, responder } = options
  const server = http.createServer(
    {
      requestTimeout: options.requestTimeout ?? defaults.requestTimeout,
      headersTimeout: options.headersTimeout ?? defaults.headersTimeout,
      keepAliveTimeout: options.keepAliveTimeout ?? defaults.keepAliveTimeout
    },
    (request, response) =>
      handleRequest({
        request,
        response,
        server,
        serverHost,
        sessionToken,
        platform,
        application,
        routeRegistry,
        responder
      })
  )
  server.maxHeadersCount = options.maxHeadersCount ?? 100
  server.maxRequestsPerSocket = options.maxRequestsPerSocket ?? 100
  server.setTimeout(options.socketTimeout ?? defaults.socketTimeout, (socket) => socket.destroy())
  return server
}

async function handleRequest(context) {
  const { request, response, server, serverHost, sessionToken, platform, application, routeRegistry, responder } =
    context
  const authority = trustedAuthority(request, serverHost, server.address())
  if (!authority) {
    return responder.sendJson(response, 400, { ok: false, error: 'Invalid Host header.' })
  }
  const url = new URL(request.url ?? '/', authority.origin)
  if (request.method === 'POST' && !authorizedMutation(request, authority.origin, sessionToken, platform.random)) {
    return responder.sendJson(response, 403, { ok: false, error: 'A same-origin viewer session is required.' })
  }
  try {
    const route = routeRegistry.find(request.method, url.pathname)
    if (!route) {
      return responder.send(response, 404, 'Not found')
    }
    await assertRoute(route).handle(Object.freeze({ request, response, url, application }))
  } catch (error) {
    sendApiError(response, error, responder)
  }
}

export function serverUrl(address) {
  if (typeof address === 'string') {
    return address
  }
  const host = address.address.includes(':') ? `[${address.address}]` : address.address
  return `http://${host}:${address.port}`
}
