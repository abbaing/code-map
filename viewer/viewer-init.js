import('./viewer-interactions.mjs')
  .then(({ createViewerUiController }) =>
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
    }).start()
  )
  .catch((error) => {
    els.status.textContent = `Error: ${error.message}`
  })
