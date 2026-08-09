import { kebab, findComponentDirIndex } from '#core/source-analysis.mjs'

export function createSourceClassifier(strategies) {
  if (!Array.isArray(strategies) || strategies.length === 0) {
    throw new TypeError('SourceClassifier strategies must be a non-empty array.')
  }
  const ids = new Set()
  const ordered = strategies.map((strategy) => {
    if (!strategy || typeof strategy.id !== 'string' || typeof strategy.classify !== 'function') {
      throw new TypeError('SourceClassifier strategies must declare id and classify(path, context).')
    }
    if (ids.has(strategy.id)) {
      throw new TypeError(`Duplicate SourceClassifier strategy id: ${strategy.id}.`)
    }
    ids.add(strategy.id)
    return Object.freeze({ id: strategy.id, classify: strategy.classify.bind(strategy) })
  })

  return Object.freeze({
    classify(repoPath, projectContext) {
      for (const strategy of ordered) {
        const result = strategy.classify(repoPath, projectContext)
        if (result === null || result === undefined) {
          continue
        }
        if (!Array.isArray(result) || result.length !== 2 || result.some((value) => typeof value !== 'string')) {
          throw new TypeError(`SourceClassifier strategy ${strategy.id} returned an invalid classification.`)
        }
        return result
      }
      throw new Error(`SourceClassifier did not classify ${repoPath}.`)
    }
  })
}

export function featureFromRepoPath(repoPath, projectContext) {
  const projectMap = projectContext.projectMap
  const shared = projectMap.modules.shared
  const frontMatch = matchPattern(repoPath, projectMap.modules.frontendFeaturePattern)
  if (frontMatch) {
    return frontMatch[1]
  }

  const rawName = repoPath.split('/').pop() ?? ''
  const stem = rawName
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[\s._-]/g, '')
  if (new Set(projectMap.modules.bootstrapStems).has(stem)) {
    return shared
  }

  const controllerMatch = matchPattern(repoPath, projectMap.modules.backendControllerPattern)
  if (controllerMatch) {
    const name = kebab(controllerMatch[1].replace(/Reporting$/, ''))
    const utilityControllers = new Set(projectMap.modules.utilityControllers)
    return utilityControllers.has(name) ? shared : name
  }

  const backMatch = matchPattern(repoPath, projectMap.modules.backendProjectFolderPattern)
  if (backMatch) {
    const folder = backMatch[1].toLowerCase().replace(/[\s._-]/g, '')
    if (new Set(projectMap.modules.infrastructureFolders).has(folder)) {
      return shared
    }
    return kebab(backMatch[1])
  }

  return shared
}

export function classifyFront(repoPath, projectContext) {
  return frontendClassifier.classify(repoPath, projectContext)
}

export function classifyBack(repoPath, projectContext) {
  return backendClassifier.classify(repoPath, projectContext)
}

const frontendClassifier = createSourceClassifier([
  { id: 'frontend-hook', classify: classifyFrontendHook },
  { id: 'frontend-component-tree', classify: classifyFrontendComponentTree },
  { id: 'frontend-configured', classify: classifyConfiguredFrontend },
  { id: 'frontend-fallback', classify: () => ['auxiliary', 'auxiliary'] }
])

const backendClassifier = createSourceClassifier([
  { id: 'backend-configured', classify: classifyConfiguredBackend },
  { id: 'backend-fallback', classify: () => ['auxiliary', 'auxiliary'] }
])

function classifyFrontendHook(repoPath) {
  const segments = repoPath.split('/')
  const basename = fileStem(repoPath)
  const parent = segments.at(-2) ?? ''
  return isHookPath(repoPath, basename, parent) ? ['hook', 'ui-component-logic'] : null
}

function classifyFrontendComponentTree(repoPath, projectContext) {
  const projectMap = projectContext.projectMap
  const segments = repoPath.split('/')
  const basename = fileStem(repoPath)
  const dirIndex = findComponentDirIndex(segments)
  if (dirIndex < 0) {
    return null
  }
  const classifier = projectMap.frontend.classifiers.find((rule) => repoPath.includes(rule.contains))
  const relativeSegments = segments.slice(dirIndex + 1)
  const isInComponents = segments[dirIndex] === 'components'
  const isInPages = segments[dirIndex] === 'pages'
  const isSubComponent =
    relativeSegments.some((segment) => segment.startsWith('_')) ||
    ((isInComponents || isInPages) && relativeSegments.length > 2)

  if (isInPages) {
    if (isSubComponent) {
      return ['subcomponent', 'ui-component-logic']
    }
    const isPageFile = relativeSegments.length === 1 && basename !== 'index'
    const isPageDirectoryIndex = relativeSegments.length === 2 && basename === 'index'
    if (isPageFile || isPageDirectoryIndex) {
      return ['page', classifier?.layer ?? 'ui-page']
    }
    return ['auxiliary', 'auxiliary']
  }

  if (isInComponents) {
    const componentName = relativeSegments[0] ?? fileStem(repoPath)
    const mainPattern = new RegExp(projectMap.frontend.componentMainNamePattern, 'u')
    const isMainComponent =
      isTopLevelComponentIndex(relativeSegments, repoPath) &&
      (mainPattern.test(componentName) || componentName.endsWith('Main'))
    if (isMainComponent) {
      return ['main-component', 'ui-main-component']
    }
  }

  if (isSubComponent) {
    return ['subcomponent', 'ui-component-logic']
  }
  return isInComponents ? ['component', 'ui-component-logic'] : null
}

function classifyConfiguredFrontend(repoPath, projectContext) {
  const classifier = projectContext.projectMap.frontend.classifiers.find((rule) => repoPath.includes(rule.contains))
  return classifier ? [classifier.type, classifier.layer] : null
}

function classifyConfiguredBackend(repoPath, projectContext) {
  const classifier = projectContext.projectMap.backend.classifiers.find((rule) => repoPath.includes(rule.contains))
  return classifier ? [classifier.type, classifier.layer] : null
}

function fileName(repoPath) {
  return repoPath.split('/').at(-1) ?? ''
}

function fileStem(repoPath) {
  const name = fileName(repoPath)
  const extensionIndex = name.lastIndexOf('.')
  return extensionIndex > 0 ? name.slice(0, extensionIndex) : name
}

function matchPattern(value, pattern) {
  if (!pattern) {
    return null
  }
  return value.match(new RegExp(pattern))
}

function isHookPath(repoPath, basename, parent) {
  return (
    /^use[A-Z0-9]/.test(basename) ||
    /^use[A-Z0-9]/.test(parent) ||
    /\/use[A-Z0-9][^/]*\/index\.[jt]sx?$/u.test(repoPath)
  )
}

function isTopLevelComponentIndex(relativeSegments, repoPath) {
  return relativeSegments.length === 2 && /^index\.[jt]sx?$/u.test(fileName(repoPath))
}
