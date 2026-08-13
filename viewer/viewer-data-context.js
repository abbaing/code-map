import { assertGraphGateway } from '#viewer/graph-gateway.mjs'

let graphGateway = null
let viewOperations = null

export function configureViewerDataContext({ gateway, operations }) {
  graphGateway = assertGraphGateway(gateway)
  viewOperations = assertViewOperations(operations)
}

export function requireGraphGateway() {
  if (!graphGateway) {
    throw new Error('Graph gateway is not configured')
  }
  return graphGateway
}

export function requireViewOperations() {
  if (!viewOperations) {
    throw new Error('Viewer data operations are not configured')
  }
  return viewOperations
}

function assertViewOperations(operations) {
  if (!operations || typeof operations !== 'object') {
    throw new TypeError('Viewer data operations must be an object')
  }
  const names = [
    'hidePopover',
    'initializeFindingsFilters',
    'renderFindings',
    'renderGraph',
    'renderModuleDetail',
    'renderOverview'
  ]
  for (const operation of names) {
    if (typeof operations[operation] !== 'function') {
      throw new TypeError(`Viewer data operations must implement ${operation}()`)
    }
  }
  return operations
}
