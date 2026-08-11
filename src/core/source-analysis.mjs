export const componentContainerDirs = Object.freeze(['components', 'pages'])

export function findComponentDirIndex(segments) {
  return Math.max(...componentContainerDirs.map((dir) => segments.indexOf(dir)))
}

export function isBackTestFile(repoPath) {
  return /\/[^/]*\.Tests\//iu.test(normalizePath(repoPath))
}

export function displayLabel(repoPath) {
  const segments = normalizePath(repoPath).split('/').filter(Boolean)
  const basename = segments.at(-1) ?? ''
  const name = basename.replace(/\.[^.]+$/u, '')
  return name === 'index' ? (segments.at(-2) ?? basename) : basename
}

export function normalizePath(input) {
  return input.replaceAll('\\', '/')
}

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function kebab(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase()
}
