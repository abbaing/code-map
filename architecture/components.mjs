import { foundationComponents } from '#architecture/components-foundation.mjs'
import { analysisComponents } from '#architecture/components-analysis.mjs'
import { deliveryComponents } from '#architecture/components-delivery.mjs'
import { viewerComponents } from '#architecture/components-viewer.mjs'

export { componentRoles, componentStatusValues } from '#architecture/component-model.mjs'

export const components = [...foundationComponents, ...analysisComponents, ...deliveryComponents, ...viewerComponents]
