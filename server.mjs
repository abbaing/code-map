import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeGraph } from './scan.mjs'
import { getConfigPathFromArgs, getProjectMap, getProjectMapPath, loadProjectMap } from './config.mjs'
import { detect } from './detect.mjs'
import { loadTemplatePlugins } from './templates/registry.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = process.cwd()
const viewerRoot = path.join(__dirname, 'viewer')
const indexPath = path.join(viewerRoot, 'viewer.html')

const port = Number(process.env.CODE_MAP_PORT) || 4179

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml'
}

function send(response, status, body, type = 'text/plain; charset=utf-8') {
  response.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store, max-age=0',
    'Pragma': 'no-cache'
  })
  response.end(body)
}

function sendFile(response, filePath) {
  if (!fs.existsSync(filePath)) {
    send(response, 404, 'Not found')
    return
  }

  response.writeHead(200, {
    'Content-Type': contentTypes[path.extname(filePath)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store, max-age=0',
    'Pragma': 'no-cache'
  })
  response.end(fs.readFileSync(filePath))
}

function graphPath() {
  return path.join(repoRoot, getProjectMap().project.graphOutput)
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', chunk => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

function serveViewer(request, response) {
  sendFile(response, indexPath)
}

function serveGraph(request, response) {
  sendFile(response, graphPath())
}

function serveProjectMap(request, response) {
  send(response, 200, JSON.stringify(getProjectMap(), null, 2), 'application/json; charset=utf-8')
}

function serveViewerAsset(request, response, url) {
  sendFile(response, path.join(viewerRoot, url.pathname.slice(1)))
}

function handleScan(request, response) {
  try {
    const graph = writeGraph(graphPath())
    send(response, 200, JSON.stringify({ ok: true, stats: graph.stats, generatedAt: graph.generatedAt }), 'application/json; charset=utf-8')
  } catch (error) {
    send(response, 500, JSON.stringify({ ok: false, error: error.message }), 'application/json; charset=utf-8')
  }
}

function handleProjectMap(request, response) {
  readRequestBody(request)
    .then(body => {
      const parsed = JSON.parse(body)
      delete parsed.configPath
      const projectMapPath = getProjectMapPath()
      if (!projectMapPath) {
        send(response, 400, JSON.stringify({
          ok: false,
          error: 'Cannot save an auto-detected project map. Export the config or restart code-map with --config <path>.'
        }), 'application/json; charset=utf-8')
        return
      }
      fs.writeFileSync(projectMapPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
      loadProjectMap(projectMapPath)
      const graph = writeGraph(graphPath())
      send(response, 200, JSON.stringify({ ok: true, projectMap: getProjectMap(), stats: graph.stats }), 'application/json; charset=utf-8')
    })
    .catch(error => {
      send(response, 500, JSON.stringify({ ok: false, error: error.message }), 'application/json; charset=utf-8')
    })
}

function isViewerAsset(pathname) {
  return pathname === '/viewer.css'
    || (pathname.startsWith('/viewer-') && pathname.endsWith('.js'))
}

const routes = [
  { method: 'GET',  test: p => p === '/',               handler: serveViewer },
  { method: 'GET',  test: p => p === '/graph.json',     handler: serveGraph },
  { method: 'GET',  test: p => p === '/project-map.json', handler: serveProjectMap },
  { method: 'GET',  test: isViewerAsset,                handler: serveViewerAsset },
  { method: 'POST', test: p => p === '/api/scan',       handler: handleScan },
  { method: 'POST', test: p => p === '/api/project-map', handler: handleProjectMap },
]

export function startServer() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`)
    const route = routes.find(r => r.method === request.method && r.test(url.pathname))
    if (route) {
      route.handler(request, response, url)
    } else {
      send(response, 404, 'Not found')
    }
  })
  server.listen(port, () => {
    console.log(`Code map available at http://localhost:${port}`)
  })
  return server
}

// Run directly: node server.mjs [--config path]
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const configPath = getConfigPathFromArgs()
  if (configPath) loadProjectMap(configPath)
  else loadProjectMap(detect(repoRoot))
  await loadTemplatePlugins(getProjectMap(), configPath ?? path.join(repoRoot, 'project-map.json'))
  writeGraph(graphPath())
  startServer()
}
