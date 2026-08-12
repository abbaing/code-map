import {
  csharpDescendants,
  csharpName,
  csharpSimpleTypeName,
  csharpTypeIdentifiers,
  walkCSharp
} from '#parsers/csharp.mjs'

export function constructorDependencies(syntax) {
  const className = syntax.declarations.find((item) => item.kind === 'class')?.name
  let declaration = null
  walkCSharp(syntax.tree.rootNode, (node) => {
    if (!declaration && node.type === 'class_declaration' && csharpName(node) === className) {
      declaration = node
    }
  })
  if (!declaration) {
    return []
  }

  const parameterLists = declaration.namedChildren.filter((child) => child.type === 'parameter_list')
  const body = declaration.namedChildren.find((child) => child.type === 'declaration_list')
  for (const constructor of body?.namedChildren.filter((child) => child.type === 'constructor_declaration') ?? []) {
    const parameters = constructor.namedChildren.find((child) => child.type === 'parameter_list')
    if (parameters) {
      parameterLists.push(parameters)
    }
  }

  const dependencies = new Map()
  for (const parameters of parameterLists) {
    for (const parameter of parameters.namedChildren.filter((child) => child.type === 'parameter')) {
      const parameterName = parameter.childForFieldName('name')
      const type =
        parameter.childForFieldName('type') ??
        parameter.namedChildren.find((child) => child.id !== parameterName?.id && child.type !== 'attribute_list')
      const name = csharpSimpleTypeName(type)
      if (!name || !/^[A-ZI]/u.test(name)) {
        continue
      }
      const display = type.text.replace(/\s+/gu, ' ').trim()
      const typeArguments = csharpDescendants(type, 'type_argument_list').flatMap(csharpTypeIdentifiers)
      dependencies.set(`${name}:${display}`, { name, display, typeArguments })
    }
  }
  return [...dependencies.values()]
}
