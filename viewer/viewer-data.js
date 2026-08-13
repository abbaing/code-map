import { configureViewerDataContext, requireGraphGateway, requireViewOperations } from '#viewer/viewer-data-context.js'
import { applyFilters } from '#viewer/viewer-filters.js'
import { initializeFilters } from '#viewer/viewer-filter-initialization.js'
import { state } from '#viewer/viewer-state.js'

export function configureViewerData({ gateway, operations }) {
  configureViewerDataContext({ gateway, operations })
}

export async function loadGraph() {
  state.graph = await requireGraphGateway().loadGraph()
  state.selectedId = null
  requireViewOperations().hidePopover()
  initializeFilters()
  applyFilters()
}

export { applyFilters, initializeFilters }
export { isCoverable } from '#viewer/viewer-filters.js'
export { requireGraphGateway } from '#viewer/viewer-data-context.js'
