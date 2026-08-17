import {
  applyPan,
  createSelectionSubmap,
  createTraceSubmap,
  exportGraph,
  exportProjectMap,
  exportSubgraphSelection,
  importGraph,
  importProjectMap,
  populateSettingsTab,
  refreshGraph,
  resetZoom,
  saveConfig,
  saveSubmapRevision,
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
import { closeSubmapPreview, loadSubmaps, openSubmap, previewSubmap, renderSubmaps } from '#viewer/viewer-submaps.js'
import {
  clearSubgraphSelection,
  discardSubmapChanges,
  replaceSubgraphSelection,
  toggleSubgraphNode
} from '#viewer/viewer-subgraph-selection.js'
import { debounce } from '#viewer/viewer-utils.js'

export function startViewer(options = {}) {
  const context = resolveViewerContext(options)
  configureViewerElements(context.elements)
  configureViewerData({
    gateway: context.gateway,
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

  return context
    .controllerFactory({
      state,
      elements: context.elements,
      document: context.document,
      browser: context.browser,
      clipboard: createClipboard(context.navigator),
      operations: viewerOperations()
    })
    .start()
    .catch((error) => {
      context.elements.status.textContent = `Error: ${error.message}`
    })
}

function resolveViewerContext(options) {
  return {
    browser: options.browser ?? globalThis.window,
    controllerFactory: options.controllerFactory ?? createViewerUiController,
    document: options.document ?? globalThis.document,
    elements: options.elements ?? els,
    gateway: options.gateway ?? createGraphGateway(),
    navigator: options.navigator ?? globalThis.navigator
  }
}

function createClipboard(navigatorRef) {
  return {
    writeText(value) {
      if (!navigatorRef?.clipboard?.writeText) {
        return Promise.reject(new Error('Clipboard access is unavailable'))
      }
      return navigatorRef.clipboard.writeText(value)
    }
  }
}

function viewerOperations() {
  return {
    applyFilters,
    applyPan,
    clearSelectedNode,
    clearSubgraphSelection,
    closeSubmapPreview,
    discardSubmapChanges,
    createSelectionSubmap,
    createTraceSubmap,
    debounce,
    drillIntoModule,
    exportGraph,
    exportProjectMap,
    exportSubgraphSelection,
    importGraph,
    importProjectMap,
    loadGraph,
    loadSubmaps,
    openSubmap,
    previewSubmap,
    populateSettingsTab,
    refreshGraph,
    render,
    renderModuleDetail,
    renderSubmaps,
    replaceSubgraphSelection,
    resetZoom,
    saveConfig,
    saveSubmapRevision,
    selectNode,
    setZoom,
    showToast,
    toggleSubgraphNode,
    updateViewUI,
    zoomAt
  }
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  startViewer()
}
