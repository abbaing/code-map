const operationNames = [
  'applyFilters',
  'applyPan',
  'clearSelectedNode',
  'clearSubgraphSelection',
  'closeSubmapPreview',
  'discardSubmapChanges',
  'createTraceSubmap',
  'createSelectionSubmap',
  'debounce',
  'drillIntoModule',
  'exportGraph',
  'exportProjectMap',
  'exportSubgraphSelection',
  'importGraph',
  'importProjectMap',
  'invertVisibleSubgraphSelection',
  'loadGraph',
  'loadSubmaps',
  'openSubmap',
  'previewSubmap',
  'populateSettingsTab',
  'refreshGraph',
  'render',
  'renderModuleDetail',
  'renderSubmaps',
  'replaceSubgraphSelection',
  'resetZoom',
  'saveConfig',
  'saveSubmapRevision',
  'selectVisibleSubgraphNodes',
  'selectNode',
  'setZoom',
  'showToast',
  'toggleSubgraphNode',
  'updateViewUI',
  'zoomAt'
]

const interactiveElementNames = [
  'actionsBtn',
  'actionsMenu',
  'createTraceSubmapBtn',
  'exportBtn',
  'filterBtn',
  'filterPanel',
  'findingsModule',
  'findingsOnly',
  'findingsRule',
  'findingsSearch',
  'findingsSeverity',
  'findingsTable',
  'graph',
  'selectionBox',
  'selectionBar',
  'selectionClearBtn',
  'selectionCreateBtn',
  'selectionDiscardBtn',
  'selectionSaveBtn',
  'selectionContextClearBtn',
  'selectionContextCreateBtn',
  'selectionContextDiscardBtn',
  'selectionContextExportBtn',
  'selectionContextInvertBtn',
  'selectionContextMenu',
  'selectionContextRemoveBtn',
  'selectionContextSaveBtn',
  'selectionContextSelectAllBtn',
  'selectionNameInput',
  'graphFilterBtn',
  'graphFilterPanel',
  'graphSearch',
  'healthChecks',
  'hideAuxiliary',
  'importFile',
  'metaPill',
  'orphansOnly',
  'overviewScroll',
  'refreshBtn',
  'reviewOnly',
  'search',
  'settingsExportBtn',
  'settingsImportFile',
  'settingsSaveBtn',
  'submapList',
  'submapPreviewCloseBtn',
  'submapPreviewBody',
  'submapPreviewOpenBtn',
  'submapSearch',
  'submapsPane',
  'statsPopover',
  'tabDomain',
  'tabFindings',
  'tabGraph',
  'tabOverview',
  'tabSettings',
  'tabSubmaps',
  'typeChecks',
  'uncoveredOnly',
  'zoomInBtn',
  'zoomOutBtn',
  'zoomResetBtn'
]

export function assertViewerUiDependencies(dependencies) {
  if (!dependencies || typeof dependencies !== 'object') {
    throw new TypeError('Viewer UI dependencies must be an object')
  }
  assertObject(dependencies.state, 'Viewer UI state must be an object')
  assertObject(dependencies.elements, 'Viewer UI elements must be an object')
  for (const name of interactiveElementNames) {
    assertEventTarget(dependencies.elements[name], name)
  }
  assertEventTarget(dependencies.elements.canvasWrap, 'canvasWrap')
  assertObject(dependencies.document, 'Viewer UI document capability must be an object')
  assertObject(dependencies.browser, 'Viewer UI browser capability must be an object')
  if (typeof dependencies.document.addEventListener !== 'function') {
    throw new TypeError('Viewer UI document must support addEventListener()')
  }
  for (const operation of ['setTimeout', 'clearTimeout']) {
    if (typeof dependencies.browser[operation] !== 'function') {
      throw new TypeError(`Viewer UI browser must implement ${operation}()`)
    }
  }
  if (!dependencies.clipboard || typeof dependencies.clipboard.writeText !== 'function') {
    throw new TypeError('Viewer UI clipboard must implement writeText()')
  }
  assertObject(dependencies.operations, 'Viewer UI operations must be an object')
  for (const name of operationNames) {
    if (typeof dependencies.operations[name] !== 'function') {
      throw new TypeError(`Viewer UI operations must implement ${name}()`)
    }
  }
  return dependencies
}

function assertObject(value, message) {
  if (!value || typeof value !== 'object') {
    throw new TypeError(message)
  }
}

function assertEventTarget(element, name) {
  if (!element || typeof element.addEventListener !== 'function') {
    throw new TypeError(`Viewer UI element ${name} must support addEventListener()`)
  }
}
