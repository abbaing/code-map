import { csharpDescendants, csharpName, csharpStringValue, walkCSharp } from '#parsers/csharp.mjs'

export function csharpStringConstants(tree) {
  const constants = []
  walkCSharp(tree.rootNode, (node) => {
    if (node.type !== 'field_declaration' || !node.children.some((child) => child.text === 'const')) {
      return
    }
    for (const declarator of csharpDescendants(node, 'variable_declarator')) {
      const name = csharpName(declarator)
      const value = csharpConstantStringValue(declarator.namedChildren.at(-1))
      if (name && value !== null) {
        const owner = enclosingTypeName(node)
        constants.push({ name, qualifiedName: owner ? `${owner}.${name}` : name, value })
      }
    }
  })
  return constants
}

function csharpConstantStringValue(node) {
  if (!node) {
    return null
  }
  if (['string_literal', 'verbatim_string_literal', 'raw_string_literal'].includes(node.type)) {
    return csharpStringValue(node)
  }
  if (node.type === 'parenthesized_expression') {
    return csharpConstantStringValue(node.namedChildren[0])
  }
  if (node.type === 'binary_expression' && node.children.some((child) => child.type === '+')) {
    const [leftNode, rightNode] = node.namedChildren
    const left = csharpConstantStringValue(leftNode)
    const right = csharpConstantStringValue(rightNode)
    return left === null || right === null ? null : left + right
  }
  return null
}

function enclosingTypeName(node) {
  let current = node.parent
  while (current) {
    if (['class_declaration', 'struct_declaration', 'record_declaration'].includes(current.type)) {
      return csharpName(current)
    }
    current = current.parent
  }
  return null
}
