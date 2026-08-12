import path from 'node:path'
import { walk, maxSourceFileBytes } from '#core/scan-utils.mjs'

export function discoverFiles(projectContext, registry) {
  const { projectMap, resolveChildPath, toRepoPath } = projectContext
  const skippedByPath = new Map()
  const walkOptions = {
    maxFileBytes: maxSourceFileBytes,
    ignoredDirs: projectMap.ignoredDirs,
    fileSystem: projectContext.platform.fileSystem,
    resolveChildPath,
    toRepoPath,
    onSkippedFile: (skipped) => skippedByPath.set(skipped.filePath, skipped)
  }
  const byKind = new Map()
  for (const kind of registry.capabilities.fileKinds) {
    byKind.set(kind.id, collectFileKind(projectContext, kind, walkOptions))
  }
  const skippedFiles = [...skippedByPath.values()].sort((a, b) => a.filePath.localeCompare(b.filePath))
  const kinds = registry.capabilities.fileKinds
  const filesFor = (predicate) =>
    Object.freeze([...new Set(kinds.filter(predicate).flatMap((kind) => byKind.get(kind.id) ?? []))].sort())
  const sets = Object.freeze(Object.fromEntries([...byKind].map(([id, files]) => [id, Object.freeze(files)])))
  return Object.freeze({
    sets,
    of: (kindId) => sets[kindId] ?? Object.freeze([]),
    sourceFiles: filesFor((kind) => !kind.testsOnly),
    testFiles: filesFor((kind) => kind.testsOnly),
    allFiles: filesFor(() => true),
    skippedFiles: Object.freeze(skippedFiles)
  })
}

function collectFileKind(projectContext, kind, walkOptions) {
  const { projectMap, resolveRepoPath, toRepoPath } = projectContext
  const root = projectMap.sourceRoots?.[kind.rootKey]
  if (!root) {
    return []
  }
  const rootPath = resolveRepoPath(root)
  const extensions = new Set(kind.extensions ?? [])
  const allFiles = walk(rootPath, (file) => extensions.size === 0 || extensions.has(path.extname(file)), walkOptions)
  return allFiles.filter((file) => {
    const repoPath = toRepoPath(file)
    const test = Boolean(kind.test?.(repoPath, file))
    if (kind.testsOnly) {
      return test
    }
    if (kind.includeTests) {
      return true
    }
    return !test
  })
}
