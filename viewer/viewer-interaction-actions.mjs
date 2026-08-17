export function bindViewerActions(context, changeView) {
  bindMenus(context.elements)
  bindGraphActions(context)
  bindTabs(context.elements, changeView)
  bindSettingsActions(context.elements, context.operations)
}

function bindMenus(elements) {
  elements.metaPill.addEventListener('click', (event) => {
    event.stopPropagation()
    elements.statsPopover.classList.toggle('hidden')
  })
  elements.actionsBtn.addEventListener('click', (event) => {
    event.stopPropagation()
    elements.actionsMenu.classList.toggle('hidden')
  })
}

function bindGraphActions({ elements, state, operations }) {
  elements.refreshBtn.addEventListener('click', operations.refreshGraph)
  elements.exportBtn.addEventListener('click', operations.exportGraph)
  elements.createTraceSubmapBtn.addEventListener('click', operations.createTraceSubmap)
  elements.selectionCreateBtn.addEventListener('click', operations.createSelectionSubmap)
  elements.selectionSaveBtn.addEventListener('click', operations.saveSubmapRevision)
  elements.selectionDiscardBtn.addEventListener('click', operations.discardSubmapChanges)
  elements.selectionClearBtn.addEventListener('click', operations.clearSubgraphSelection)
  elements.submapSearch.addEventListener('input', operations.renderSubmaps)
  elements.zoomInBtn.addEventListener('click', () => operations.setZoom(state.zoom + 0.15))
  elements.zoomOutBtn.addEventListener('click', () => operations.setZoom(state.zoom - 0.15))
  elements.zoomResetBtn.addEventListener('click', operations.resetZoom)
  elements.importFile.addEventListener('change', (event) => {
    const file = event.target.files[0]
    if (file) {
      operations.importGraph(file)
    }
  })
}

function bindTabs(elements, changeView) {
  const tabs = [
    [elements.tabOverview, 'overview'],
    [elements.tabGraph, 'graph'],
    [elements.tabDomain, 'domain'],
    [elements.tabSubmaps, 'submaps'],
    [elements.tabFindings, 'findings'],
    [elements.tabSettings, 'settings']
  ]
  for (const [element, view] of tabs) {
    element.addEventListener('click', () => changeView(view))
  }
}

function bindSettingsActions(elements, operations) {
  elements.settingsSaveBtn.addEventListener('click', operations.saveConfig)
  elements.settingsExportBtn.addEventListener('click', operations.exportProjectMap)
  elements.settingsImportFile.addEventListener('change', (event) => {
    const file = event.target.files[0]
    if (file) {
      operations.importProjectMap(file)
    }
  })
}
