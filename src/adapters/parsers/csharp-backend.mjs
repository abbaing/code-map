import path from 'node:path'
import {
  csharpArguments,
  csharpAttributes,
  csharpDescendants,
  csharpInvocationName,
  csharpName,
  csharpSimpleTypeName,
  csharpStringValue,
  csharpTypeIdentifiers,
  csharpParser,
  walkCSharp
} from '#parsers/csharp.mjs'

export const csharpBackendFacts = Object.freeze({
  backendSemantics: (document) => backendSemantics(document),
  constructorDependencies: ({ syntax }) => constructorDependencies(syntax),
  controller: ({ syntax }) => controllerAnalysis(syntax.tree),
  dispatchedRequests: ({ syntax }) => [...collectDispatchedRequests(syntax.tree.rootNode)],
  dbSets: ({ syntax }) => dbSets(syntax),
  tableName: ({ syntax }) => tableName(syntax.tree),
  entityProperties: ({ syntax }) => entityProperties(syntax.tree),
  entityUsage: ({ syntax }, input) => entityUsage(syntax.tree.rootNode, input.entity, input.dbSet)
})

export const csharpBackendParser = Object.freeze({
  ...csharpParser,
  facts: Object.freeze({ ...csharpParser.facts, ...csharpBackendFacts })
})

function backendSemantics(document) {
  const { declarations, tree } = document.syntax
  const stem = path.basename(document.file, '.cs')
  let hasDbSet = false
  let implementsRequestHandler = false
  walkCSharp(tree.rootNode, (node) => {
    if (node.type !== 'generic_name') {
      return
    }
    const name = csharpName(node)
    hasDbSet ||= name === 'DbSet'
    implementsRequestHandler ||= name === 'IRequestHandler'
  })
  return {
    isDbContext: declarations.some((declaration) => declaration.baseTypes.includes('DbContext')) || hasDbSet,
    isRequestHandler: implementsRequestHandler || /(?:Command|Query)Handler$/u.test(stem),
    isMarkerInterface:
      /^I[A-Z]/u.test(stem) &&
      declarations.some((declaration) => declaration.kind === 'interface' && declaration.name === stem)
  }
}

function constructorDependencies(syntax) {
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

function controllerAnalysis(tree) {
  const controller = firstNode(tree.rootNode, 'class_declaration')
  const route = csharpAttributes(controller).find((attribute) => attribute.name === 'Route')?.value
  return {
    name: csharpName(controller),
    route,
    actions: parseControllerActions(controller).map((action) => ({
      method: action.method,
      route: action.route,
      name: action.name,
      dispatchedRequests: [...dispatchedRequestsForAction(controller, action.node)]
    }))
  }
}

function parseControllerActions(controller) {
  const body = controller?.namedChildren.find((child) => child.type === 'declaration_list')
  const actions = []
  for (const method of body?.namedChildren.filter((child) => child.type === 'method_declaration') ?? []) {
    const http = csharpAttributes(method).find((attribute) =>
      ['HttpGet', 'HttpPost', 'HttpPut', 'HttpPatch', 'HttpDelete'].includes(attribute.name)
    )
    if (http) {
      actions.push({
        method: http.name.slice('Http'.length).toUpperCase(),
        route: http.value ?? '',
        name: csharpName(method),
        node: method
      })
    }
  }
  return actions
}

function dispatchedRequestsForAction(controller, action) {
  const requests = collectDispatchedRequests(action)
  if (requests.size > 0) {
    return requests
  }
  const body = controller.namedChildren.find((child) => child.type === 'declaration_list')
  const methods = new Map(
    (body?.namedChildren.filter((child) => child.type === 'method_declaration') ?? []).map((method) => [
      csharpName(method),
      method
    ])
  )
  for (const helperName of collectInvokedMethodNames(action)) {
    const helper = methods.get(helperName)
    if (helper) {
      for (const request of collectDispatchedRequests(helper)) {
        requests.add(request)
      }
    }
  }
  return requests
}

function collectInvokedMethodNames(node) {
  const names = new Set()
  const ignored = new Set(['Send', 'Ok', 'BadRequest', 'NoContent', 'StatusCode', 'Unauthorized', 'NotFound'])
  walkCSharp(node, (candidate) => {
    if (candidate.type !== 'invocation_expression' || candidate.namedChildren[0]?.type !== 'identifier') {
      return
    }
    const name = csharpInvocationName(candidate)
    if (name && /^[A-Z]/u.test(name) && !ignored.has(name)) {
      names.add(name)
    }
  })
  return names
}

function collectDispatchedRequests(node) {
  const requests = new Set()
  walkCSharp(node, (candidate) => {
    if (candidate.type === 'object_creation_expression') {
      const name = csharpSimpleTypeName(candidate.namedChildren[0])
      if (isRequestName(name)) {
        requests.add(name)
      }
    }
    if (candidate.type === 'parameter') {
      const type =
        candidate.childForFieldName('type') ?? candidate.namedChildren.find((child) => child.type !== 'attribute_list')
      const name = csharpSimpleTypeName(type)
      if (isRequestName(name)) {
        requests.add(name)
      }
    }
  })
  return requests
}

function isRequestName(name) {
  return typeof name === 'string' && (name.endsWith('Query') || name.endsWith('Command'))
}

function firstNode(root, type) {
  let result = null
  walkCSharp(root, (node) => {
    if (!result && node.type === type) {
      result = node
    }
  })
  return result
}

function dbSets(syntax) {
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

function tableName(tree) {
  const toTable = csharpDescendants(tree.rootNode, 'invocation_expression').find(
    (invocation) => csharpInvocationName(invocation) === 'ToTable'
  )
  return csharpStringValue(csharpArguments(toTable)[0])
}

function entityProperties(tree) {
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

function entityUsage(root, entity, dbSet) {
  let usage = null
  walkCSharp(root, (node) => {
    if (usage?.confidence === 'high') {
      return
    }
    if (node.type === 'generic_name') {
      const name = csharpSimpleTypeName(node)
      const argumentsList = csharpDescendants(node, 'type_argument_list').flatMap(csharpTypeIdentifiers)
      if (argumentsList.includes(entity) && name === 'Set') {
        usage = { reason: `ORM Set<${entity}>`, confidence: 'high', persistence: true }
      } else if (argumentsList.includes(entity) && ['IRepository', 'IReadRepository', 'Repository'].includes(name)) {
        usage = { reason: `repository ${entity}`, confidence: 'high', persistence: true }
      }
    }
    if (dbSet && node.type === 'member_access_expression' && node.namedChildren.some((child) => child.text === dbSet)) {
      usage = { reason: `DbSet ${dbSet}`, confidence: 'high', persistence: true }
    } else if (!usage && node.type === 'identifier' && node.text === entity) {
      usage = { reason: `entity ${entity}`, confidence: 'medium', persistence: false }
    }
  })
  return usage
}
