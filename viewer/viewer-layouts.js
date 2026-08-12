import { layoutDomainNodes } from '#viewer/viewer-layout-domain.js'
import { layoutLayeredNodes } from '#viewer/viewer-layout-layered.js'
import { layoutSystemModules } from '#viewer/viewer-layout-system.js'
import { state } from '#viewer/viewer-state.js'

function layoutNodes(nodes, width, height) {
  return state.view === 'domain' ? layoutDomainNodes(nodes, width, height) : layoutLayeredNodes(nodes, width, height)
}

export { layoutNodes, layoutSystemModules }
