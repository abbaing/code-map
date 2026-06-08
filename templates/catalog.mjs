import { filesystemTemplate } from './core.mjs'
import { typescriptTemplate } from './typescript.mjs'
import { reactTemplate } from './react.mjs'
import { httpEndpointsTemplate } from './http-endpoints.mjs'
import { dotnetApiTemplate } from './dotnet-api.mjs'
import { entityFrameworkTemplate } from './entity-framework.mjs'
import { coverageTemplate, qualityTemplate } from './quality.mjs'
import { architectureTemplates } from './architectures.mjs'

export const templateCatalog = [
  filesystemTemplate,
  typescriptTemplate,
  reactTemplate,
  httpEndpointsTemplate,
  dotnetApiTemplate,
  entityFrameworkTemplate,
  coverageTemplate,
  qualityTemplate,
  ...architectureTemplates
]
