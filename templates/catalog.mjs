import { filesystemTemplate } from '#templates/core.mjs'
import { typescriptTemplate } from '#templates/typescript.mjs'
import { csharpTemplate } from '#templates/csharp.mjs'
import { reactTemplate } from '#templates/react.mjs'
import { httpEndpointsTemplate } from '#templates/http-endpoints.mjs'
import { dotnetApiTemplate } from '#templates/dotnet-api.mjs'
import { entityFrameworkTemplate } from '#templates/entity-framework.mjs'
import { coverageTemplate, qualityTemplate } from '#templates/quality.mjs'
import { architectureTemplates } from '#templates/architectures.mjs'

export const templateCatalog = [
  filesystemTemplate,
  typescriptTemplate,
  csharpTemplate,
  reactTemplate,
  httpEndpointsTemplate,
  dotnetApiTemplate,
  entityFrameworkTemplate,
  coverageTemplate,
  qualityTemplate,
  ...architectureTemplates
]
