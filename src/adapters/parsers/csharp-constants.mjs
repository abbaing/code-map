import { csharpDescendants, csharpName, csharpStringValue, walkCSharp } from '#parsers/csharp.mjs'

export function csharpStringConstants(tree) {
  const constants = []
  walkCSharp(tree.rootNode, (node) => {
    if (node.type !== 'field_declaration' || !node.children.some((child) => child.text === 'const')) {
      return
    }
    for (const declarator of csharpDescendants(node, 'variable_declarator')) {
      const name = csharpName(declarator)
      const value = csharpStringValue(declarator.namedChildren.at(-1))
      if (name && value !== null) {
        const owner = enclosingTypeName(node)
        constants.push({ name, qualifiedName: owner ? `${owner}.${name}` : name, value })
      }
    }
  })
  return constants
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
