export function fixtureGraph() {
  const nodes = [
    node('ui:route', 'LoginRoute', 'route', 'ui', 'auth', 'src/auth/LoginRoute.tsx'),
    node('auth:service', 'AuthService', 'service', 'application', 'auth', 'src/auth/AuthService.ts'),
    node('auth:repo', 'AuthRepository', 'repository', 'infrastructure', 'auth', 'src/auth/AuthRepository.ts'),
    node('shared:db', 'Database', 'database', 'infrastructure', 'shared', 'src/shared/Database.ts'),
    node('billing:service', 'BillingService', 'service', 'application', 'billing', 'src/billing/BillingService.ts')
  ].sort((a, b) => a.id.localeCompare(b.id))
  const edges = [
    edge('ui:route', 'auth:service', 'calls'),
    edge('auth:service', 'auth:repo', 'imports'),
    edge('auth:repo', 'shared:db', 'queries'),
    edge('shared:db', 'billing:service', 'used-by')
  ].sort((a, b) => a.id.localeCompare(b.id))
  return {
    version: 1,
    generatedAt: '2026-08-05T00:00:00.000Z',
    stats: { nodes: nodes.length, edges: edges.length },
    projectMap: {
      project: { name: 'Fixture' },
      modules: { labels: { auth: 'Authentication' } },
      layers: [{ id: 'application', label: 'Application' }],
      types: { labels: { service: 'Service' } }
    },
    nodes,
    edges,
    findings: [
      {
        id: 'finding:1',
        ruleId: 'architecture.demo',
        severity: 'warning',
        message: 'Demo finding',
        nodeId: 'auth:service'
      }
    ],
    suppressedFindings: [],
    orphans: [nodes.find((item) => item.id === 'billing:service')],
    templates: ['filesystem'],
    architecture: [],
    ruleMetadata: {}
  }
}

function node(...fields) {
  const [id, label, type, layer, module, path] = fields
  return { id, label, type, layer, module, path, meta: {} }
}

function edge(from, to, type) {
  return { id: `${from}::${type}::${to}`, from, to, type, label: type, confidence: 'high', source: 'fixture' }
}
