import path from 'node:path'
import { getConfigPathFromArgs, loadProjectContext } from '#core/config.mjs'

export async function prepareCliProject(input, capabilities) {
  const { args, repoRoot } = input
  const { platform, output, detector, templates } = capabilities
  const configPath = resolveConfigPath(args, repoRoot, platform)
  const prepared = configPath
    ? loadConfiguredProject(configPath, repoRoot, platform, output)
    : loadDetectedProject(repoRoot, platform, output, detector)
  if (!prepared) {
    return null
  }
  try {
    await templates.load(prepared.context.projectMap, prepared.pluginBasePath, {
      allow: args.includes('--allow-plugins')
    })
  } catch (error) {
    output.error(error.message)
    return null
  }
  return prepared.context
}

function resolveConfigPath(args, repoRoot, platform) {
  const configIndex = args.indexOf('--config')
  const environmentPath = platform.environment.variable('CODE_MAP_CONFIG')
  const explicit =
    configIndex >= 0 && args[configIndex + 1]
      ? path.resolve(repoRoot, args[configIndex + 1])
      : environmentPath
        ? path.resolve(repoRoot, environmentPath)
        : null
  return (
    explicit ??
    getConfigPathFromArgs(platform.environment.args(), {
      cwd: repoRoot,
      configPath: environmentPath,
      fileSystem: platform.fileSystem
    })
  )
}

function loadConfiguredProject(configPath, repoRoot, platform, output) {
  if (!platform.fileSystem.exists(configPath)) {
    output.error(`Config file not found: ${configPath}`)
    return null
  }
  const context = loadProjectContext(configPath, { repoRoot, platform })
  output.log(`Using config: ${path.relative(repoRoot, configPath)}`)
  return { context, pluginBasePath: configPath }
}

function loadDetectedProject(repoRoot, platform, output, detector) {
  const { fileSystem } = platform
  const summary = detector.summarize(repoRoot, { fileSystem })
  output.log(
    `Auto-detected: ${summary.frontendFramework ?? 'unknown'} + ${summary.backendStack ?? 'none'}, ${summary.moduleCount} modules`
  )
  output.log('Tip: run with --init to generate a project-map.json you can customize.')
  const context = loadProjectContext(detector.detect(repoRoot, { fileSystem }), { repoRoot, platform })
  return { context, pluginBasePath: path.join(repoRoot, 'project-map.json') }
}
