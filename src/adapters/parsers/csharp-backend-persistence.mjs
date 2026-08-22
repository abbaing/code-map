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

export function tableMapping(tree) {
  const configuration = csharpDescendants(tree.rootNode, 'generic_name').find(
    (node) => csharpSimpleTypeName(node) === 'IEntityTypeConfiguration'
  )
  if (!configuration) {
    return undefined
  }
  const entity = csharpDescendants(configuration, 'type_argument_list').flatMap(csharpTypeIdentifiers)[0]
  const table = tableName(tree)
  return entity && table ? { entity, table } : undefined
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

export function entityUsages(root, entities, dbSets) {
  const entityNames = new Set(entities)
  const entityByDbSet = new Map([...dbSets].map(([entity, dbSet]) => [dbSet, entity]))
  const usages = new Map()
  walkCSharp(root, (node) => {
    collectGenericUsages(node, entityNames, usages)
    if (node.type === 'member_access_expression') {
      for (const child of node.namedChildren) {
        const entity = entityByDbSet.get(child.text)
        if (entity) {
          usages.set(entity, { reason: `DbSet ${child.text}`, confidence: 'high', persistence: true })
        }
      }
    }
    if (node.type === 'identifier' && entityNames.has(node.text) && !usages.has(node.text)) {
      usages.set(node.text, { reason: `entity ${node.text}`, confidence: 'medium', persistence: false })
    }
  })
  return usages
}

function collectGenericUsages(node, entityNames, usages) {
  if (node.type !== 'generic_name') {
    return
  }
  const name = csharpSimpleTypeName(node)
  const argumentsList = csharpDescendants(node, 'type_argument_list').flatMap(csharpTypeIdentifiers)
  for (const entity of argumentsList.filter((candidate) => entityNames.has(candidate))) {
    if (name === 'Set') {
      usages.set(entity, { reason: `ORM Set<${entity}>`, confidence: 'high', persistence: true })
    } else if (['IRepository', 'IReadRepository', 'Repository'].includes(name)) {
      usages.set(entity, { reason: `repository ${entity}`, confidence: 'high', persistence: true })
    }
  }
}
