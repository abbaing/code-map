import ts from 'typescript'
import { isTestFile, tsExtensions } from '#parsers/typescript-files.mjs'
import { resolveTsImport } from '#parsers/typescript-resolver.mjs'

export { ts as typescript }
export { isTestFile, tsExtensions } from '#parsers/typescript-files.mjs'

export function stripTsComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

export function moduleReferencesOf(content, fileName = 'source.ts', parsedSourceFile) {
  const sourceFile = parsedSourceFile ?? parseTypeScript(content, fileName)
  const constantBindings = topLevelConstantBindingsOf(sourceFile)
  const references = []

  function visit(node) {
    const reference = moduleReferenceOf(node, sourceFile, constantBindings)
    if (reference) {
      references.push(reference)
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return references.sort((left, right) => left.index - right.index)
}

function moduleReferenceOf(node, sourceFile, constantBindings) {
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier &&
    ts.isStringLiteralLike(node.moduleSpecifier)
  ) {
    return { specifier: node.moduleSpecifier.text, index: node.getStart(sourceFile), kind: 'static' }
  }
  if (!ts.isCallExpression(node) || node.arguments.length !== 1) {
    return null
  }
  if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
    const specifier = staticStringValueOf(node.arguments[0], constantBindings)
    return specifier === null ? null : { specifier, index: node.expression.getStart(sourceFile), kind: 'dynamic' }
  }
  if (
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'require' &&
    ts.isStringLiteralLike(node.arguments[0])
  ) {
    return { specifier: node.arguments[0].text, index: node.expression.getStart(sourceFile), kind: 'static' }
  }
  return null
}

function staticStringValueOf(node, constantBindings, resolving = new Set()) {
  if (ts.isStringLiteralLike(node)) {
    return node.text
  }
  if (ts.isTemplateExpression(node)) {
    return staticTemplateValueOf(node, constantBindings, resolving)
  }
  if (ts.isParenthesizedExpression(node)) {
    return staticStringValueOf(node.expression, constantBindings, resolving)
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticStringValueOf(node.left, constantBindings, resolving)
    const right = staticStringValueOf(node.right, constantBindings, resolving)
    return left === null || right === null ? null : left + right
  }
  if (ts.isIdentifier(node) && constantBindings.has(node.text) && !resolving.has(node.text)) {
    const nextResolving = new Set(resolving).add(node.text)
    return staticStringValueOf(constantBindings.get(node.text), constantBindings, nextResolving)
  }
  return null
}

function staticTemplateValueOf(node, constantBindings, resolving) {
  let value = node.head.text
  for (const span of node.templateSpans) {
    const expression = staticStringValueOf(span.expression, constantBindings, resolving)
    if (expression === null) {
      return null
    }
    value += expression + span.literal.text
  }
  return value
}

function topLevelConstantBindingsOf(sourceFile) {
  const bindings = new Map()
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement) || !(statement.declarationList.flags & ts.NodeFlags.Const)) {
      continue
    }
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        bindings.set(declaration.name.text, declaration.initializer)
      }
    }
  }
  return bindings
}

export function typeScriptConstantStringBindings(sourceFile) {
  const declarations = topLevelConstantBindingsOf(sourceFile)
  const bindings = new Map()
  for (const [name, initializer] of declarations) {
    const value = staticStringValueOf(initializer, declarations)
    if (value !== null) {
      bindings.set(name, value)
    }
  }
  return bindings
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
