import { kebab, findComponentDirIndex } from '#core/source-analysis.mjs'
import { createSourceClassifier } from '#core/classifier-registry.mjs'
export { createSourceClassifier } from '#core/classifier-registry.mjs'

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
    return classifyPage(relativeSegments, basename, isSubComponent, classifier)
  }
  if (isInComponents && isMainComponent(relativeSegments, repoPath, projectMap)) {
    return ['main-component', 'ui-main-component']
  }
  if (isSubComponent) {
    return ['subcomponent', 'ui-component-logic']
  }
  return isInComponents ? ['component', 'ui-component-logic'] : null
}

function classifyPage(relativeSegments, basename, isSubComponent, classifier) {
  if (isSubComponent) {
    return ['subcomponent', 'ui-component-logic']
  }
  const isPageFile = relativeSegments.length === 1 && basename !== 'index'
  const isDirectoryIndex = relativeSegments.length === 2 && basename === 'index'
  return isPageFile || isDirectoryIndex ? ['page', classifier?.layer ?? 'ui-page'] : ['auxiliary', 'auxiliary']
}

function isMainComponent(relativeSegments, repoPath, projectMap) {
  const componentName = relativeSegments[0] ?? fileStem(repoPath)
  const pattern = new RegExp(projectMap.frontend.componentMainNamePattern, 'u')
  return (
    isTopLevelComponentIndex(relativeSegments, repoPath) &&
    (pattern.test(componentName) || componentName.endsWith('Main'))
  )
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
