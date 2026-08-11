import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createProjectContext as createContext, loadProjectContext as loadContext } from '#core/project-context.mjs'
import { validateProjectMap as validateMap } from '#core/config-validation.mjs'
import { normalizeProjectMap as normalizeMap } from '#core/config-normalization.mjs'

const directory = path.dirname(fileURLToPath(import.meta.url))
export const defaultProjectMapPath = path.join(directory, 'presets/starter.project-map.json')

export { getConfigPathFromArgs } from '#core/project-context.mjs'

export function loadProjectContext(source, options = {}) {
  return loadContext(source, { defaultConfigPath: defaultProjectMapPath, ...options })
}
export function normalizeProjectMap(projectMap, configPath = null, { repoRoot = '.' } = {}) {
  return normalizeMap(projectMap, configPath, {
    repoRoot,
    toRepoPath: (root, filePath) => path.relative(root, filePath).replaceAll(path.sep, '/')
  })
}

export function validateProjectMap(projectMap, configPath = defaultProjectMapPath, options = {}) {
  return validateMap(projectMap, configPath, options)
}

export function createProjectContext(projectMap, options = {}) {
  return createContext(projectMap, { defaultConfigPath: defaultProjectMapPath, ...options })
}
