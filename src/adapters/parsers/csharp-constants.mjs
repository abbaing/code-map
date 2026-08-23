import { csharpDescendants, csharpName, csharpStringValue, walkCSharp } from '#parsers/csharp.mjs'

export function csharpStringConstants(tree) {
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
  return resolvedConstantsOf(declarations)
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
