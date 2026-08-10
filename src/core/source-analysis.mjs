export const tsExtensions = Object.freeze(['.ts', '.tsx', '.js', '.jsx'])
export const componentContainerDirs = Object.freeze(['components', 'pages'])

export function findComponentDirIndex(segments) {
  return Math.max(...componentContainerDirs.map((dir) => segments.indexOf(dir)))
}

export function isTestFile(filePath) {
  return /\.(spec|test)\.[cm]?[jt]sx?$/u.test(filePath)
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

export function stripCSharpStringLiterals(content) {
  return content
    .replace(/\$?"""[\s\S]*?"""/g, '""')
    .replace(/@(?:"(?:""|[^"])*")/g, '""')
    .replace(/\$?"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])'/g, "''")
}

export function stripCSharpComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

export function stripTsComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

export function importsOf(content) {
  const pattern = /(^|[;\n])([ \t]*(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"])/gm
  return [...stripTsComments(content).matchAll(pattern)].map((match) => ({
    specifier: match[3],
    index: (match.index ?? 0) + match[1].length + match[2].search(/\b(?:import|export)\b/u)
  }))
}

export function kebab(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase()
}
