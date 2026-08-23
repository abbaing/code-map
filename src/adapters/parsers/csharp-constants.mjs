import { csharpDescendants, csharpName, csharpStringValue, walkCSharp } from '#parsers/csharp.mjs'

export function csharpStringConstants(tree) {
  return resolvedConstantsOf(constantDeclarationsOf(tree))
}

export function csharpStringConstantExpressions(tree) {
  return constantDeclarationsOf(tree).flatMap((declaration) => {
    const parts = stringExpressionParts(declaration.initializer)
    return parts
      ? [{ name: declaration.name, owner: declaration.owner, qualifiedName: declaration.qualifiedName, parts }]
      : []
  })
}

function constantDeclarationsOf(tree) {
  const declarations = []
  walkCSharp(tree.rootNode, (node) => {
    if (node.type !== 'field_declaration' || !node.children.some((child) => child.text === 'const')) {
      return
    }
    for (const declarator of csharpDescendants(node, 'variable_declarator')) {
      const name = csharpName(declarator)
      const initializer = declarator.namedChildren.at(-1)
      if (name && initializer && initializer !== declarator.childForFieldName('name')) {
        const owner = enclosingTypeName(node)
        declarations.push({ name, owner, qualifiedName: owner ? `${owner}.${name}` : name, initializer })
      }
    }
  })
  return declarations
}

function stringExpressionParts(node) {
  if (!node) {
    return null
  }
  if (['string_literal', 'verbatim_string_literal', 'raw_string_literal'].includes(node.type)) {
    const value = csharpStringValue(node)
    return value === null ? null : [{ kind: 'literal', value }]
  }
  if (node.type === 'parenthesized_expression') {
    return stringExpressionParts(node.namedChildren[0])
  }
  if (node.type === 'binary_expression' && node.children.some((child) => child.type === '+')) {
    const left = stringExpressionParts(node.namedChildren[0])
    const right = stringExpressionParts(node.namedChildren[1])
    return left && right ? [...left, ...right] : null
  }
  return ['identifier', 'member_access_expression', 'qualified_name'].includes(node.type)
    ? [{ kind: 'reference', name: node.text }]
    : null
}

function resolvedConstantsOf(declarations) {
  const byQualifiedName = new Map(declarations.map((declaration) => [declaration.qualifiedName, declaration]))
  const byName = uniqueDeclarationsByName(declarations)
  const cache = new Map()
  const resolving = new Set()

  function resolve(declaration) {
    if (!declaration || resolving.has(declaration.qualifiedName)) {
      return undefined
    }
    if (cache.has(declaration.qualifiedName)) {
      return cache.get(declaration.qualifiedName)
    }
    resolving.add(declaration.qualifiedName)
    const value = csharpStringValue(declaration.initializer, (reference) =>
      resolve(referenceDeclaration(reference, declaration.owner, byQualifiedName, byName))
    )
    resolving.delete(declaration.qualifiedName)
    cache.set(declaration.qualifiedName, value ?? undefined)
    return value ?? undefined
  }

  return declarations.flatMap((declaration) => {
    const value = resolve(declaration)
    return value === undefined ? [] : [{ name: declaration.name, qualifiedName: declaration.qualifiedName, value }]
  })
}

function uniqueDeclarationsByName(declarations) {
  const byName = new Map()
  const ambiguous = new Set()
  for (const declaration of declarations) {
    if (byName.has(declaration.name)) {
      ambiguous.add(declaration.name)
    } else {
      byName.set(declaration.name, declaration)
    }
  }
  for (const name of ambiguous) {
    byName.delete(name)
  }
  return byName
}

function referenceDeclaration(reference, owner, byQualifiedName, byName) {
  return byQualifiedName.get(reference) ?? byQualifiedName.get(`${owner}.${reference}`) ?? byName.get(reference)
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
