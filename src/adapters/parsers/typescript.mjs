import ts from 'typescript'
import { resolveTsImport } from '#parsers/typescript-resolver.mjs'

export { ts as typescript }

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

export function stripTsComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

export function moduleReferencesOf(content, fileName = 'source.ts', parsedSourceFile) {
  const sourceFile = parsedSourceFile ?? parseTypeScript(content, fileName)
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

export function parseTypeScript(content, fileName = 'source.ts') {
  return ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true, scriptKindOf(fileName))
}

export function walkTypeScript(node, visitor) {
  visitor(node)
  ts.forEachChild(node, (child) => walkTypeScript(child, visitor))
}

export function typeScriptLiteralValue(node, sourceFile) {
  if (!node) {
    return null
  }
  if (ts.isStringLiteralLike(node)) {
    return node.text
  }
  if (ts.isTemplateExpression(node)) {
    return node.getText(sourceFile).slice(1, -1)
  }
  return null
}

export function typeScriptCallName(expression) {
  if (ts.isIdentifier(expression)) {
    return expression.text
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text
  }
  return null
}

export function importsOf(content, fileName, parsedSourceFile) {
  return moduleReferencesOf(content, fileName, parsedSourceFile)
    .filter(({ kind }) => kind === 'static')
    .map(({ specifier, index }) => ({ specifier, index }))
}

export function countTypeScriptTestCases(document) {
  const sourceFile = document.syntax
  let count = 0
  walkTypeScript(sourceFile, (node) => {
    if (!ts.isCallExpression(node)) {
      return
    }
    const expression = node.expression
    if (ts.isIdentifier(expression) && ['it', 'test'].includes(expression.text)) {
      count += 1
    } else if (
      ts.isPropertyAccessExpression(expression) &&
      ['only', 'skip', 'todo', 'concurrent', 'each'].includes(typeScriptCallName(expression)) &&
      ts.isIdentifier(expression.expression) &&
      ['it', 'test'].includes(expression.expression.text)
    ) {
      count += 1
    }
  })
  return count
}

export const typescriptParser = Object.freeze({
  id: 'typescript',
  extensions: tsExtensions,
  parse: parseTypeScript,
  isTest: isTestFile,
  facts: Object.freeze({
    moduleReferences: (document) => moduleReferencesOf(document.content, document.file, document.syntax),
    testCaseCount: countTypeScriptTestCases
  }),
  resolveReference: ({ file, reference, context }) => resolveTsImport(file, reference, context)
})

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
