export class ApplicationInputError extends Error {}

const applicationOperations = ['graphPath', 'projectMap', 'scan', 'saveProjectMap', 'listSubmaps', 'createTraceSubmap']
const serviceOperations = Object.freeze({
  scanner: Object.freeze(['scan']),
  projectMaps: Object.freeze(['validate', 'load', 'write', 'restore']),
  submaps: Object.freeze(['create', 'filename', 'list', 'read', 'write'])
})

export function assertServerApplication(application) {
  return assertOperations(application, applicationOperations, 'Server application')
}

export function assertServerApplicationServices(services) {
  if (!services || typeof services !== 'object') {
    throw new TypeError('Server application services are required.')
  }
  for (const [capability, operations] of Object.entries(serviceOperations)) {
    assertOperations(services[capability], operations, `Server application capability ${capability}`)
  }
  return services
}

export const serverApplicationContract = Object.freeze([...applicationOperations])
export const serverApplicationServicesContract = serviceOperations

function assertOperations(implementation, operations, label) {
  if (!implementation || typeof implementation !== 'object') {
    throw new TypeError(`${label} implementation is required.`)
  }
  for (const operation of operations) {
    if (typeof implementation[operation] !== 'function') {
      throw new TypeError(`${label} must implement ${operation}().`)
    }
  }
  return implementation
}
