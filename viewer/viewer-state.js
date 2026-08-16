import { createViewerStore } from '#viewer/viewer-store.mjs'
import { resolveViewerElements } from '#viewer/viewer-elements.js'

export const NODE_RENDER_LIMIT = 400
export const DOMAIN_RENDER_LIMIT = 1200

export const viewerStore = createViewerStore({
  graph: null,
  submaps: [],
  filteredNodes: [],
  selectedId: null,
  subgraphNodeIds: new Set(),
  showAllTrace: false,
  trace: null,
  selectedTypes: new Set(),
  selectedHealth: new Set(['excellent', 'very-good', 'good', 'fair', 'low', 'critical']),
  zoom: 1,
  panX: 0,
  panY: 0,
  fitView: false,
  dragMoved: false,
  suppressOutsideReset: false,
  view: 'overview',
  activeModule: null
})
export const state = viewerStore.state

export const moduleLabels = {}
export const layerOrder = []
export const layerLabels = {}
export const typeLabels = {}
export const colors = {}

export let els = typeof document === 'undefined' ? null : resolveViewerElements(document)

export function configureViewerElements(elements) {
  if (!elements || typeof elements !== 'object') {
    throw new TypeError('Viewer elements must be an object')
  }
  els = elements
}

export { resolveViewerElements }
