import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getConfigPathFromArgs, loadProjectContext } from '#core/config.mjs'
import { detect } from '#node/detect-node.mjs'
import { loadTemplatePlugins } from '#templates/registry.mjs'
import { assertServerApplication, createServerApplication } from '#app/server-app.mjs'
import { nodeServerApplicationServices } from '#node/server-app-node.mjs'
import { nodePlatform } from '#platform/node.mjs'
import { assertRouteRegistry, createRouteRegistry } from '#core/http-routes.mjs'
import { createHttpResponder } from '#entry/src/delivery/http-response.mjs'
import { createViewerAssets } from '#entry/src/delivery/viewer-assets.mjs'
import { createViewerRoutes } from '#entry/src/delivery/http-routes.mjs'
import { createHttpServer, serverUrl } from '#entry/src/delivery/http-server.mjs'

const directory = path.dirname(fileURLToPath(import.meta.url))
const viewer = createViewerAssets(path.join(directory, 'viewer'))

export function startServer(options = {}) {
  const platform = options.platform ?? nodePlatform
  const repoRoot = options.repoRoot ?? platform.environment.cwd()
  const port = resolvePort(options, platform)
  const host = resolveHost(options, platform)
  const log = options.log ?? console.log
  const sessionToken = options.sessionToken ?? platform.random.token(32)
  const application = resolveApplication(options, platform, repoRoot)
  const responder = createHttpResponder(viewer.securityHeaders)
  const routes = createViewerRoutes({ sessionToken, application, viewer, responder })
  const routeRegistry = assertRouteRegistry(options.routeRegistry ?? createRouteRegistry(routes))
  const server = createHttpServer({
    ...options,
    platform,
    serverHost: host,
    sessionToken,
    application,
    routeRegistry,
    responder
  })
  server.listen(port, host, () => log(`Code map available at ${serverUrl(server.address())}`))
  return server
}

function resolvePort(options, platform) {
  return options.port ?? (Number(platform.environment.variable('CODE_MAP_PORT')) || 1133)
}

function resolveHost(options, platform) {
  return options.host ?? (platform.environment.variable('CODE_MAP_HOST')?.trim() || '127.0.0.1')
}

function resolveApplication(options, platform, repoRoot) {
  const application =
    options.application ??
    createServerApplication({
      projectContext: options.projectContext ?? loadProjectContext(undefined, { repoRoot, platform }),
      repoRoot,
      services: options.applicationServices ?? nodeServerApplicationServices
    })
  return assertServerApplication(application)
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
  const application = createServerApplication({ projectContext, repoRoot, services: nodeServerApplicationServices })
  application.scan()
  startServer({ application, projectContext })
}
