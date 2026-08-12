import path from 'node:path'
import { pathToFileURL } from 'node:url'

export async function loadTemplatePlugins(projectMap, configPath, register, { allow = false } = {}) {
  const plugins = projectMap.templates?.plugins
  if (!Array.isArray(plugins) || plugins.length === 0) {
    return
  }
  if (!allow) {
    throw new Error(
      'Custom template plugins are disabled by default. Review the configured modules and re-run with --allow-plugins to trust them.'
    )
  }
  const configDirectory = path.dirname(path.resolve(configPath))
  for (const pluginPath of plugins) {
    const resolved = path.isAbsolute(pluginPath) ? pluginPath : path.resolve(configDirectory, pluginPath)
    const module = await import(pathToFileURL(resolved).href)
    for (const exported of Object.values(module)) {
      if (exported?.id) {
        register(exported)
      }
    }
  }
}
