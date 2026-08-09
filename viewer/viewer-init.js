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
import { els, state } from '#viewer/viewer-state.js'
import { debounce } from '#viewer/viewer-utils.js'

configureViewerData({
  gateway: createGraphGateway(),
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

createViewerUiController({
  state,
  elements: els,
  document,
  browser: window,
  clipboard: {
    writeText(value) {
      if (!navigator.clipboard?.writeText) {
        return Promise.reject(new Error('Clipboard access is unavailable'))
      }
      return navigator.clipboard.writeText(value)
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
    els.status.textContent = `Error: ${error.message}`
  })
