import path from 'node:path'
import { getProjectMap } from './config.mjs'
import { kebab, findComponentDirIndex } from './scan-utils.mjs'

export function featureFromRepoPath(repoPath) {
  const projectMap = getProjectMap()
  const shared = projectMap.modules.shared
  const frontMatch = matchPattern(repoPath, projectMap.modules.frontendFeaturePattern)
  if (frontMatch) return frontMatch[1]

  const rawName = repoPath.split('/').pop() ?? ''
  const stem = rawName.replace(/\.[^.]+$/, '').toLowerCase().replace(/[\s._-]/g, '')
  if (new Set(projectMap.modules.bootstrapStems).has(stem)) return shared

  const controllerMatch = matchPattern(repoPath, projectMap.modules.backendControllerPattern)
  if (controllerMatch) {
    const name = kebab(controllerMatch[1].replace(/Reporting$/, ''))
    const utilityControllers = new Set(projectMap.modules.utilityControllers)
    return utilityControllers.has(name) ? shared : name
  }

  const backMatch = matchPattern(repoPath, projectMap.modules.backendProjectFolderPattern)
  if (backMatch) {
    const folder = backMatch[1].toLowerCase().replace(/[\s._-]/g, '')
    if (new Set(projectMap.modules.infrastructureFolders).has(folder)) return shared
    return kebab(backMatch[1])
  }

  return shared
}

export function classifyFront(repoPath) {
  const projectMap = getProjectMap()
  const segments = repoPath.split('/')
  const basename = path.basename(repoPath, path.extname(repoPath))
  const parent = segments.at(-2) ?? ''

  if (isHookPath(repoPath, basename, parent)) return ['hook', 'ui-component-logic']

  const classifier = projectMap.frontend.classifiers.find(rule => repoPath.includes(rule.contains))
  if (classifier && classifier.type !== 'component') return [classifier.type, classifier.layer]

  const dirIndex = findComponentDirIndex(segments)

  if (dirIndex >= 0) {
    const relativeSegments = segments.slice(dirIndex + 1)
    const isInComponents = segments[dirIndex] === 'components'
    const isSubComponent = relativeSegments.some(segment => segment.startsWith('_'))
      || (isInComponents && relativeSegments.length > 2)

    if (isInComponents) {
      const componentName = relativeSegments[0] ?? path.basename(repoPath, path.extname(repoPath))
      const mainPattern = new RegExp(projectMap.frontend.componentMainNamePattern, 'u')
      const isMainComponent = isTopLevelComponentIndex(relativeSegments, repoPath)
        && (mainPattern.test(componentName) || componentName.endsWith('Main'))

      if (isMainComponent) return ['main-component', 'ui-main-component']
    }

    if (isSubComponent) return ['subcomponent', 'ui-component-logic']
    if (isInComponents) return ['component', 'ui-component-logic']
  }

  if (classifier) return [classifier.type, classifier.layer]
  return ['auxiliary', 'auxiliary']
}

export function classifyBack(repoPath) {
  const classifier = getProjectMap().backend.classifiers.find(rule => repoPath.includes(rule.contains))
  if (classifier) return [classifier.type, classifier.layer]
  return ['auxiliary', 'auxiliary']
}

function matchPattern(value, pattern) {
  if (!pattern) return null
  return value.match(new RegExp(pattern))
}

function isHookPath(repoPath, basename, parent) {
  return /^use[A-Z0-9]/.test(basename)
    || /^use[A-Z0-9]/.test(parent)
    || /\/use[A-Z0-9][^/]*\/index\.[jt]sx?$/u.test(repoPath)
}

function isTopLevelComponentIndex(relativeSegments, repoPath) {
  return relativeSegments.length === 2 && /^index\.[jt]sx?$/u.test(path.basename(repoPath))
}
