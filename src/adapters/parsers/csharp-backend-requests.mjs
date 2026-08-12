import {
  csharpAttributes,
  csharpInvocationName,
  csharpName,
  csharpSimpleTypeName,
  walkCSharp
} from '#parsers/csharp.mjs'

export function controllerAnalysis(tree) {
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

export function collectDispatchedRequests(node) {
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
