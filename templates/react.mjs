import { scanFront } from '../scan-front.mjs'
import { pickRuleMetadata } from './rule-metadata.mjs'

export const reactTemplate = {
  id: 'react',
  stage: 'framework',
  description: 'React UI classification, component behavior signals, and React-specific guardrails.',
  layers: [
    { id: 'ui-route', label: 'Routes' },
    { id: 'ui-page', label: 'Pages' },
    { id: 'ui-main-component', label: 'Main Components' },
    { id: 'ui-component-logic', label: 'Components / Logic' },
    { id: 'front-service', label: 'Frontend Services' },
    { id: 'front-repository', label: 'Frontend Repositories' },
    { id: 'front-schema', label: 'Schemas' }
  ],
  types: {
    labels: {
      auxiliary: 'Auxiliary',
      config: 'Config',
      schema: 'Schema',
      component: 'Component',
      hook: 'Hook',
      'main-component': 'Main Component',
      page: 'Page',
      repository: 'Repository',
      route: 'Route',
      service: 'Service',
      store: 'Store',
      subcomponent: 'Subcomponent'
    },
    colors: {
      route: '#7c3aed',
      page: '#0891b2',
      'main-component': '#0891b2',
      component: '#0891b2',
      subcomponent: '#0891b2',
      hook: '#2563eb',
      service: '#2563eb',
      repository: '#2563eb',
      auxiliary: '#94a3b8',
      config: '#cbd5e1',
      store: '#64748b'
    }
  },
  rules: {
    enabled: [
      'framework.react.component-max-lines',
      'framework.react.route-file-shape',
      'framework.react.component-folder-entry'
    ],
    options: { 'framework.react.component-max-lines': { max: 200 } }
  },
  ruleMetadata: pickRuleMetadata([
    'framework.react.component-max-lines',
    'framework.react.route-file-shape',
    'framework.react.component-folder-entry'
  ]),
  capabilities: {
    scanners: [{ id: 'react.frontend', assign: 'frontEndpointIds', run: context => scanFront(context.graph, context.files.frontFiles) }]
  }
}
