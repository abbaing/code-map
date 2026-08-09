import path from 'node:path'
import { tsExtensions } from './source-analysis.mjs'

export function aliases(projectContext) {
  return projectContext.projectMap.imports.aliases.map((alias) => [
    alias.prefix,
    projectContext.resolveRepoPath(alias.path) + path.sep
  ])
}

export function resolveTsImport(fromFile, specifier, projectContext) {
  if (!specifier || (!specifier.startsWith('.') && !specifier.startsWith('@'))) {
    return null
  }

  let base
  if (specifier.startsWith('.')) {
    base = path.resolve(path.dirname(fromFile), specifier)
  } else {
    const alias = aliases(projectContext).find(([prefix]) => specifier.startsWith(prefix))
    if (!alias) {
      return null
    }
    base = path.resolve(alias[1], specifier.slice(alias[0].length))
  }

  const candidates = []
  if (tsExtensions.includes(path.extname(base))) {
    candidates.push(base)
  } else {
    for (const ext of tsExtensions) {
      candidates.push(`${base}${ext}`)
    }
    for (const ext of tsExtensions) {
      candidates.push(path.join(base, `index${ext}`))
    }
  }

  return candidates.find((candidate) => projectContext.platform.fileSystem.exists(candidate)) ?? null
}
