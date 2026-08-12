import { tsExtensions } from '#parsers/typescript-files.mjs'

export function aliases(projectContext) {
  return projectContext.projectMap.imports.aliases.map((alias) => [
    alias.prefix,
    projectContext.resolveRepoPath(alias.path)
  ])
}

export function resolveTsImport(fromFile, specifier, projectContext) {
  const resolver = createImportResolver({
    strategies: defaultImportStrategies,
    exists: projectContext.platform.fileSystem.exists
  })
  return resolver.resolve(fromFile, specifier, projectContext)
}

export function createImportResolver({ strategies, exists, extensions = tsExtensions }) {
  if (typeof exists !== 'function') {
    throw new TypeError('ImportResolver requires an exists(path) capability.')
  }
  if (!Array.isArray(strategies) || strategies.length === 0) {
    throw new TypeError('ImportResolver strategies must be a non-empty array.')
  }
  const ids = new Set()
  const ordered = strategies.map((strategy) => {
    if (!strategy || typeof strategy.id !== 'string' || typeof strategy.resolveBase !== 'function') {
      throw new TypeError('ImportResolver strategies must declare id and resolveBase(input).')
    }
    if (ids.has(strategy.id)) {
      throw new TypeError(`Duplicate ImportResolver strategy id: ${strategy.id}.`)
    }
    ids.add(strategy.id)
    return Object.freeze({ id: strategy.id, resolveBase: strategy.resolveBase.bind(strategy) })
  })

  return Object.freeze({
    resolve(fromFile, specifier, projectContext) {
      return resolveImport(fromFile, specifier, projectContext, ordered, extensions, exists)
    }
  })
}

const defaultImportStrategies = [
  {
    id: 'relative',
    resolveBase: ({ fromFile, specifier, projectContext }) =>
      specifier.startsWith('.') ? projectContext.resolvePathFrom(fromFile, specifier) : null
  },
  {
    id: 'configured-alias',
    resolveBase({ specifier, projectContext }) {
      if (!specifier.startsWith('@')) {
        return null
      }
      const alias = aliases(projectContext).find(([prefix]) => specifier.startsWith(prefix))
      return alias ? projectContext.resolveChildPath(alias[1], specifier.slice(alias[0].length)) : null
    }
  }
]

function resolveImport(...args) {
  const [fromFile, specifier, projectContext, strategies, extensions, exists] = args
  if (!specifier || (!specifier.startsWith('.') && !specifier.startsWith('@'))) {
    return null
  }

  let base = null
  for (const strategy of strategies) {
    base = strategy.resolveBase({ fromFile, specifier, projectContext })
    if (base !== null && base !== undefined) {
      break
    }
  }
  if (!base) {
    return null
  }

  const candidates = []
  if (extensions.some((extension) => base.endsWith(extension))) {
    candidates.push(base)
  } else {
    for (const ext of extensions) {
      candidates.push(`${base}${ext}`)
    }
    for (const ext of extensions) {
      candidates.push(projectContext.resolveChildPath(base, `index${ext}`))
    }
  }

  return candidates.find((candidate) => exists(candidate)) ?? null
}
