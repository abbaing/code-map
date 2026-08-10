import {
  applyPan,
  createTraceSubmap,
  exportGraph,
  exportProjectMap,
  importGraph,
  importProjectMap,
  populateSettingsTab,
  refreshGraph,
  resetZoom,
  saveConfig,
  setZoom,
  showToast,
  zoomAt
} from '#viewer/viewer-actions.js'
import { applyFilters, configureViewerData, loadGraph } from '#viewer/viewer-data.js'
import { initializeFindingsFilters, renderFindings } from '#viewer/viewer-findings.js'
import { createGraphGateway } from '#viewer/graph-gateway.mjs'
import { render } from '#viewer/viewer-graph.js'
import { createViewerUiController } from '#viewer/viewer-interactions.mjs'
import { drillIntoModule, renderModuleDetail, renderOverview, updateViewUI } from '#viewer/viewer-overview.js'
import { clearSelectedNode, configureViewerSelection, hidePopover, selectNode } from '#viewer/viewer-selection.js'
import { configureViewerElements, els, state } from '#viewer/viewer-state.js'
import { debounce } from '#viewer/viewer-utils.js'

export function startViewer(options = {}) {
  const documentRef = options.document ?? globalThis.document
  const browser = options.browser ?? globalThis.window
  const navigatorRef = options.navigator ?? globalThis.navigator
  const elements = options.elements ?? els
  const gateway = options.gateway ?? createGraphGateway()
  const controllerFactory = options.controllerFactory ?? createViewerUiController

  configureViewerElements(elements)
  configureViewerData({
    gateway,
    operations: {
      hidePopover,
      initializeFindingsFilters,
      renderFindings,
      renderGraph: render,
      renderModuleDetail,
      renderOverview
    }
  })
  configureViewerSelection({ renderModuleDetail })

  return controllerFactory({
    state,
    elements,
    document: documentRef,
    browser,
    clipboard: {
      writeText(value) {
        if (!navigatorRef?.clipboard?.writeText) {
          return Promise.reject(new Error('Clipboard access is unavailable'))
        }
        return navigatorRef.clipboard.writeText(value)
      }
    },
    operations: {
      applyFilters,
      applyPan,
      clearSelectedNode,
      createTraceSubmap,
      debounce,
      drillIntoModule,
      exportGraph,
      exportProjectMap,
      importGraph,
      importProjectMap,
      loadGraph,
      populateSettingsTab,
      refreshGraph,
      render,
      renderModuleDetail,
      resetZoom,
      saveConfig,
      selectNode,
      setZoom,
      showToast,
      updateViewUI,
      zoomAt
    }
  })
    .start()
    .catch((error) => {
      elements.status.textContent = `Error: ${error.message}`
    })
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  startViewer()
}
