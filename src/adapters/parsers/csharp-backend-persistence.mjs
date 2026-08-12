import {
  csharpArguments,
  csharpDescendants,
  csharpInvocationName,
  csharpName,
  csharpSimpleTypeName,
  csharpStringValue,
  csharpTypeIdentifiers,
  walkCSharp
} from '#parsers/csharp.mjs'

export function dbSets(syntax) {
  const result = []
  for (const property of csharpDescendants(syntax.tree.rootNode, 'property_declaration')) {
    const type =
      property.childForFieldName('type') ?? property.namedChildren.find((child) => child.type === 'generic_name')
    if (type?.type !== 'generic_name' || csharpSimpleTypeName(type) !== 'DbSet') {
      continue
    }
    const entity = csharpDescendants(type, 'type_argument_list').flatMap(csharpTypeIdentifiers)[0]
    const name = csharpName(property)
    if (entity && name) {
      result.push({ entity, name })
    }
  }
  return result
}

export function tableName(tree) {
  const toTable = csharpDescendants(tree.rootNode, 'invocation_expression').find(
    (invocation) => csharpInvocationName(invocation) === 'ToTable'
  )
  return csharpStringValue(csharpArguments(toTable)[0])
}

export function entityProperties(tree) {
  const properties = []
  const seen = new Set()
  for (const property of csharpDescendants(tree.rootNode, 'property_declaration')) {
    if (!property.namedChildren.some((child) => child.type === 'modifier' && child.text === 'public')) {
      continue
    }
    const typeNode =
      property.childForFieldName('type') ?? property.namedChildren.find((child) => child.type !== 'modifier')
    const name = csharpName(property)
    const type = typeNode?.text.replace(/\s+/gu, ' ').trim()
    if (!name || !type || seen.has(name)) {
      continue
    }
    seen.add(name)
    properties.push({ name, type, typeNames: csharpTypeIdentifiers(typeNode) })
  }
  return properties
}

export function entityUsage(root, entity, dbSet) {
  let usage = null
  walkCSharp(root, (node) => {
    usage = usage?.confidence === 'high' ? usage : usageForNode(node, entity, dbSet, usage)
  })
  return usage
}

function usageForNode(node, entity, dbSet, current) {
  const generic = genericUsage(node, entity)
  if (generic) {
    return generic
  }
  if (dbSet && node.type === 'member_access_expression' && node.namedChildren.some((child) => child.text === dbSet)) {
    return { reason: `DbSet ${dbSet}`, confidence: 'high', persistence: true }
  }
  return !current && node.type === 'identifier' && node.text === entity
    ? { reason: `entity ${entity}`, confidence: 'medium', persistence: false }
    : current
}

function genericUsage(node, entity) {
  if (node.type !== 'generic_name') {
    return null
  }
  const name = csharpSimpleTypeName(node)
  const argumentsList = csharpDescendants(node, 'type_argument_list').flatMap(csharpTypeIdentifiers)
  if (!argumentsList.includes(entity)) {
    return null
  }
  if (name === 'Set') {
    return { reason: `ORM Set<${entity}>`, confidence: 'high', persistence: true }
  }
  return ['IRepository', 'IReadRepository', 'Repository'].includes(name)
    ? { reason: `repository ${entity}`, confidence: 'high', persistence: true }
    : null
}
