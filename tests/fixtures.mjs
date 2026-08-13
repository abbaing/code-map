import { architectureBackendFixture } from '#tests/fixtures-architecture-backend.mjs'
import { architectureFrontendFixture } from '#tests/fixtures-architecture-frontend.mjs'
export { createFixtureTree } from '#tests/fixture-tree.mjs'
export { typescriptFixture } from '#tests/fixtures-typescript.mjs'

export const architectureFixture = {
  ...architectureBackendFixture,
  ...architectureFrontendFixture
}
