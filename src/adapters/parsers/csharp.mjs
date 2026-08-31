import Parser from 'tree-sitter'
import CSharp from 'tree-sitter-c-sharp/bindings/node/index.js'
import { normalizePath } from '#core/source-analysis.mjs'

const parser = new Parser()
parser.setLanguage(CSharp)

export function parseCSharp(content) {
  return parser.parse(content)
}

export function isCSharpTestFile(filePath) {
  return /\/[^/]*\.Tests\//iu.test(normalizePath(filePath))
}

export function createCSharpDocument(content) {
  const tree = parseCSharp(content)
  return Object.freeze({ tree, declarations: Object.freeze(csharpTypeDeclarationsFromTree(tree)) })
}

export const csharpParser = Object.freeze({
  id: 'csharp',
  extensions: Object.freeze(['.cs']),
  parse: (content) => createCSharpDocument(content),
  isTest: isCSharpTestFile,
  facts: Object.freeze({
    typeDeclarations: (document) => document.syntax.declarations
  })
})

export function walkCSharp(node, visitor) {
  visitor(node)
  for (const child of node.namedChildren) {
    walkCSharp(child, visitor)
  }
}

export function csharpDescendants(node, type) {
  const matches = []
  walkCSharp(node, (candidate) => {
    if (candidate.type === type) {
      matches.push(candidate)
    }
  })
  return matches
}

export function csharpName(node) {
  return node.childForFieldName('name')?.text ?? null
}

export function csharpSimpleTypeName(node) {
  if (!node) {
    return null
  }
  if (node.type === 'identifier' || node.type === 'predefined_type') {
    return node.text
  }
  if (node.type === 'generic_name') {
    return node.namedChildren.find((child) => child.type === 'identifier')?.text ?? null
  }
  const identifiers = csharpDescendants(node, 'identifier')
  return identifiers.at(-1)?.text ?? null
}

export function csharpTypeIdentifiers(node) {
  if (!node) {
    return []
  }
  const names = []
  walkCSharp(node, (candidate) => {
    if (candidate.type === 'identifier') {
      names.push(candidate.text)
    }
  })
  return [...new Set(names)]
}

export function csharpStringValue(node, constantValue = () => undefined) {
  if (!node) {
    return null
  }
  if (['string_literal', 'verbatim_string_literal', 'raw_string_literal'].includes(node.type)) {
    return csharpLiteralStringValue(node)
  }
  if (node.type === 'parenthesized_expression') {
    return csharpStringValue(node.namedChildren[0], constantValue)
  }
  if (node.type === 'binary_expression' && node.children.some((child) => child.type === '+')) {
    const [leftNode, rightNode] = node.namedChildren
    const left = csharpStringValue(leftNode, constantValue)
    const right = csharpStringValue(rightNode, constantValue)
    return left === null || right === null ? null : left + right
  }
  const resolved = constantValue(node.text)
  return typeof resolved === 'string' ? resolved : null
}

function csharpLiteralStringValue(node) {
  const content = csharpDescendants(node, 'string_literal_content')
    .map((part) => part.text)
    .join('')
  if (content) {
    return content
  }
  const firstQuote = node.text.indexOf('"')
  const lastQuote = node.text.lastIndexOf('"')
  return firstQuote >= 0 && lastQuote > firstQuote ? node.text.slice(firstQuote + 1, lastQuote) : null
}

export function csharpAttributes(node, constantValue = () => undefined) {
  const attributes = []
  for (const list of node.namedChildren.filter((child) => child.type === 'attribute_list')) {
    for (const attribute of list.namedChildren.filter((child) => child.type === 'attribute')) {
      const nameNode = attribute.namedChildren.find((child) =>
        ['identifier', 'qualified_name', 'alias_qualified_name'].includes(child.type)
      )
      const argument = csharpArguments(attribute)[0]
      attributes.push({
        name: nameNode?.text.split('.').at(-1) ?? '',
        value: csharpStringValue(argument, constantValue),
        node: attribute
      })
    }
  }
  return attributes
}

export function csharpTypeDeclarationsFromTree(tree) {
  const declarations = []
  walkCSharp(tree.rootNode, (node) => {
    if (
      !['class_declaration', 'interface_declaration', 'record_declaration', 'struct_declaration'].includes(node.type)
    ) {
      return
    }
    const baseList = node.namedChildren.find((child) => child.type === 'base_list')
    declarations.push({
      kind: node.type.slice(0, -'_declaration'.length),
      name: csharpName(node),
      baseTypes: baseList ? baseList.namedChildren.map(csharpSimpleTypeName).filter(Boolean) : []
    })
  })
  return declarations
}

export function csharpInvocationName(node) {
  if (node?.type !== 'invocation_expression') {
    return null
  }
  const target = node.namedChildren[0]
  return target?.type === 'member_access_expression'
    ? (target.namedChildren.at(-1)?.text ?? null)
    : csharpSimpleTypeName(target)
}

export function csharpArguments(node) {
  const list = node?.namedChildren.find((child) => ['argument_list', 'attribute_argument_list'].includes(child.type))
  return list?.namedChildren.map((argument) => argument.namedChildren.at(-1) ?? argument) ?? []
}
