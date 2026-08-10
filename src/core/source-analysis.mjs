import ts from 'typescript'

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

export function moduleReferencesOf(content, fileName = 'source.ts') {
  const sourceFile = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, false, scriptKindOf(fileName))
  const references = []

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      references.push({
        specifier: node.moduleSpecifier.text,
        index: node.getStart(sourceFile),
        kind: 'static'
      })
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      references.push({
        specifier: node.arguments[0].text,
        index: node.expression.getStart(sourceFile),
        kind: 'dynamic'
      })
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return references.sort((left, right) => left.index - right.index)
}

export function importsOf(content, fileName) {
  return moduleReferencesOf(content, fileName)
    .filter(({ kind }) => kind === 'static')
    .map(({ specifier, index }) => ({ specifier, index }))
}

export function kebab(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase()
}

function scriptKindOf(fileName) {
  const extension = fileName.toLowerCase().match(/\.[^.]+$/u)?.[0]
  return (
    {
      '.js': ts.ScriptKind.JS,
      '.jsx': ts.ScriptKind.JSX,
      '.ts': ts.ScriptKind.TS,
      '.tsx': ts.ScriptKind.TSX
    }[extension] ?? ts.ScriptKind.TS
  )
}
