import { connectEndpoints } from '#core/endpoints.mjs'

export const httpEndpointsTemplate = {
  id: 'http-endpoints',
  stage: 'technology',
  description: 'HTTP endpoint extraction and frontend/backend endpoint linking.',
  layers: [{ id: 'api-endpoint', label: 'API Endpoints' }],
  types: {
    labels: { endpoint: 'API Endpoint' },
    colors: { endpoint: '#c2410c' }
  },
  capabilities: {
    scanners: [{ id: 'http.endpoints', requires: ['frontEndpointIds'], run: (context) => context.frontEndpointIds }],
    enrichers: [
      {
        id: 'http.link-endpoints',
        requires: ['graph', 'frontEndpointIds', 'controllerEndpoints'],
        run: (context) => connectEndpoints(context.graph, context.frontEndpointIds, context.controllerEndpoints)
      }
    ]
  }
}
