import { defineRoute } from '#core/http-routes.mjs'
import { ApplicationInputError } from '#app/server-app.mjs'
import { SubmapError } from '#submap/errors.mjs'
import { HttpRequestError, readJsonRequest } from '#entry/src/delivery/http-body.mjs'
import { sessionCookie } from '#entry/src/delivery/http-security.mjs'

export function createViewerRoutes({ sessionToken, application, viewer, responder }) {
  return [
    defineRoute({
      id: 'viewer.index',
      method: 'GET',
      matches: (pathname) => pathname === '/',
      handle: ({ response }) =>
        responder.send(response, 200, viewer.indexHtml, 'text/html; charset=utf-8', {
          'Set-Cookie': sessionCookie(sessionToken)
        })
    }),
    defineRoute({
      id: 'viewer.graph',
      method: 'GET',
      matches: (pathname) => pathname === '/graph.json',
      handle: ({ response }) => responder.sendGraphFile(response, application.graphPath())
    }),
    defineRoute({
      id: 'viewer.project-map',
      method: 'GET',
      matches: (pathname) => pathname === '/project-map.json',
      handle: ({ response }) => responder.sendJson(response, 200, application.projectMap())
    }),
    defineRoute({
      id: 'viewer.assets',
      method: 'GET',
      matches: (pathname) => viewer.assets.has(pathname),
      handle: ({ response, url }) => responder.sendFile(response, viewer.assets.get(url.pathname))
    }),
    defineRoute({
      id: 'api.scan',
      method: 'POST',
      matches: (pathname) => pathname === '/api/scan',
      handle: ({ response }) => handleScan(response, application, responder)
    }),
    defineRoute({
      id: 'api.project-map',
      method: 'POST',
      matches: (pathname) => pathname === '/api/project-map',
      handle: ({ request, response }) => handleProjectMap(request, response, application, responder)
    }),
    ...createSubmapRoutes(application, responder)
  ]
}

function createSubmapRoutes(application, responder) {
  return [
    defineRoute({
      id: 'api.submaps',
      method: 'GET',
      matches: (pathname) => pathname === '/api/submaps',
      handle: ({ response }) => responder.sendJson(response, 200, { submaps: application.listSubmaps() })
    }),
    defineRoute({
      id: 'api.trace-submap',
      method: 'POST',
      matches: (pathname) => pathname === '/api/submaps/from-trace',
      handle: ({ request, response }) => handleTraceSubmap(request, response, application, responder)
    }),
    defineRoute({
      id: 'api.selection-submap',
      method: 'POST',
      matches: (pathname) => pathname === '/api/submaps/from-selection',
      handle: ({ request, response }) => handleSelectionSubmap(request, response, application, responder)
    })
  ]
}

export function sendApiError(response, error, responder) {
  const { status, message } = publicError(error)
  if (status >= 500) {
    console.error(error)
  }
  if (status === 413) {
    response.setHeader('Connection', 'close')
  }
  responder.sendJson(response, status, { ok: false, error: message })
}

function handleScan(response, application, responder) {
  const graph = application.scan()
  responder.sendJson(response, 200, { ok: true, stats: graph.stats, generatedAt: graph.generatedAt })
}

async function handleProjectMap(request, response, application, responder) {
  const result = application.saveProjectMap(await readJsonRequest(request))
  responder.sendJson(response, 200, { ok: true, ...result })
}

async function handleTraceSubmap(request, response, application, responder) {
  const result = application.createTraceSubmap(await readJsonRequest(request))
  responder.sendJson(response, 200, { ok: true, ...result })
}

async function handleSelectionSubmap(request, response, application, responder) {
  const result = application.createSelectionSubmap(await readJsonRequest(request))
  responder.sendJson(response, 200, { ok: true, ...result })
}

function publicError(error) {
  if (error instanceof HttpRequestError) {
    return { status: error.status, message: error.message }
  }
  if (error instanceof ApplicationInputError) {
    return { status: 400, message: error.message }
  }
  if (error instanceof SubmapError && error.code === 'SUBMAP_OUTPUT_EXISTS') {
    return { status: 409, message: error.message }
  }
  if (error instanceof SubmapError && error.exitCode !== 1) {
    return { status: 400, message: error.message }
  }
  return { status: 500, message: 'Internal server error.' }
}
