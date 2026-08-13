import { requireViewOperations } from '#viewer/viewer-data-context.js'
import { initializeFilterControls } from '#viewer/viewer-filter-controls.js'
import { applyProjectMap } from '#viewer/viewer-project-map-presentation.js'
import { buildViewerReport } from '#viewer/viewer-report-model.js'
import { renderReportSummary } from '#viewer/viewer-report-renderer.js'
import { els, state } from '#viewer/viewer-state.js'

export function initializeFilters() {
  applyProjectMap(state.graph.projectMap)
  requireViewOperations().initializeFindingsFilters()
  initializeFilterControls(state.graph, els, document)
  renderReportSummary(buildViewerReport(state.graph), state.graph, els)
}
