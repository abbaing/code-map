const OPERATION_NAMES = Object.freeze([
  'applyFilters',
  'applyPan',
  'clearSelectedNode',
  'createTraceSubmap',
  'debounce',
  'drillIntoModule',
  'exportGraph',
  'exportProjectMap',
  'importGraph',
  'importProjectMap',
  'loadGraph',
  'populateSettingsTab',
  'refreshGraph',
  'render',
  'renderModuleDetail',
  'resetZoom',
  'saveConfig',
  'selectNode',
  'setZoom',
  'showToast',
  'updateViewUI',
  'zoomAt'
])

const INTERACTIVE_ELEMENT_NAMES = Object.freeze([
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
  'statsPopover',
  'tabDomain',
  'tabFindings',
  'tabGraph',
  'tabOverview',
  'tabSettings',
  'typeChecks',
  'uncoveredOnly',
  'zoomInBtn',
  'zoomOutBtn',
  'zoomResetBtn'
])

export function createViewerUiController(dependencies) {
  assertViewerUiDependencies(dependencies)
  const { state, elements: els, document, browser, clipboard, operations } = dependencies
  let bound = false
  let startPromise = null

  function bindWheelZoom(canvas) {
    const debouncedZoom = operations.debounce((zoom, x, y) => operations.zoomAt(zoom, x, y), 20)
    canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault()
        const step = event.deltaY > 0 ? -0.12 : 0.12
        debouncedZoom(state.zoom + step, event.clientX, event.clientY)
      },
      { passive: false }
    )
  }

  function bindPanDrag(canvas) {
    let dragging = false
    let pointerId = null
    let startX = 0
    let startY = 0
    let startPanX = 0
    let startPanY = 0

    canvas.addEventListener('pointerdown', (event) => {
      if (
        event.button !== 0 ||
        event.target.closest('.node') ||
        event.target.closest('#moduleDetail') ||
        event.target.closest('button, label, input')
      ) {
        return
      }
      dragging = true
      pointerId = event.pointerId
      state.dragMoved = false
      startX = event.clientX
      startY = event.clientY
      startPanX = state.panX
      startPanY = state.panY
      canvas.classList.add('dragging')
      canvas.setPointerCapture(pointerId)
      event.preventDefault()
    })

    canvas.addEventListener('pointermove', (event) => {
      if (!dragging) {
        return
      }
      const deltaX = event.clientX - startX
      const deltaY = event.clientY - startY
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        state.dragMoved = true
      }
      state.panX = startPanX - deltaX / state.zoom
      state.panY = startPanY - deltaY / state.zoom
      operations.applyPan()
      event.preventDefault()
    })

    canvas.addEventListener('pointerup', (event) => {
      const shouldClearSelection = dragging && !state.dragMoved && !event.target.closest('.node')
      const shouldSuppressClickReset = dragging && state.dragMoved
      dragging = false
      canvas.classList.remove('dragging')
      if (pointerId !== null && canvas.hasPointerCapture(pointerId)) {
        canvas.releasePointerCapture(pointerId)
      }
      pointerId = null
      if (shouldClearSelection) {
        operations.clearSelectedNode()
      }
      if (shouldSuppressClickReset) {
        state.suppressOutsideReset = true
      }
      browser.setTimeout(() => {
        state.dragMoved = false
        state.suppressOutsideReset = false
      }, 250)
    })

    canvas.addEventListener('pointercancel', () => {
      dragging = false
      pointerId = null
      state.dragMoved = false
      canvas.classList.remove('dragging')
    })
  }

  function bindNodeClick(svg) {
    let lastClickedId = null
    let clickTimer = null
    svg.addEventListener('click', (event) => {
      if (state.dragMoved || state.suppressOutsideReset) {
        return
      }
      const nodeElement = event.target.closest('.node')
      if (!nodeElement) {
        browser.clearTimeout(clickTimer)
        lastClickedId = null
        operations.clearSelectedNode()
        return
      }
      const id = nodeElement.dataset.id
      if (nodeElement.dataset.module) {
        browser.clearTimeout(clickTimer)
        lastClickedId = null
        operations.drillIntoModule(nodeElement.dataset.module)
        return
      }
      if (id === lastClickedId) {
        browser.clearTimeout(clickTimer)
        lastClickedId = null
        const node = state.graph.nodes.find((candidate) => candidate.id === id)
        if (!node?.path) {
          return
        }
        els.findingsSearch.value = node.path
        changeView('findings')
        return
      }
      lastClickedId = id
      clickTimer = browser.setTimeout(() => {
        operations.selectNode(id)
        lastClickedId = null
      }, 250)
    })
  }

  function changeView(view) {
    state.view = view
    state.activeModule = null
    if (view === 'domain') {
      state.panX = 0
      state.panY = 0
    }
    operations.updateViewUI()
    if (view === 'settings') {
      operations.populateSettingsTab()
    } else {
      operations.applyFilters()
    }
  }

  function bindOverview() {
    els.overviewScroll.addEventListener('click', (event) => {
      const card = event.target.closest('.module-card')
      if (card) {
        operations.drillIntoModule(card.dataset.module)
      }
    })
    const debouncedApplyFilters = operations.debounce(operations.applyFilters, 180)
    els.search.addEventListener('input', debouncedApplyFilters)
    els.healthChecks.addEventListener('change', (event) => {
      const key = event.target.dataset.health
      if (!key) {
        return
      }
      if (event.target.checked) {
        state.selectedHealth.add(key)
      } else {
        state.selectedHealth.delete(key)
      }
      operations.applyFilters()
    })
    els.filterBtn.addEventListener('click', (event) => {
      event.stopPropagation()
      const open = !els.filterPanel.classList.contains('hidden')
      els.filterPanel.classList.toggle('hidden', open)
      els.filterBtn.classList.toggle('active', !open)
    })
    els.filterPanel.addEventListener('click', (event) => event.stopPropagation())

    els.findingsSearch.addEventListener('input', debouncedApplyFilters)
    els.findingsSeverity.addEventListener('change', operations.applyFilters)
    els.findingsRule.addEventListener('change', operations.applyFilters)
    els.findingsModule.addEventListener('change', operations.applyFilters)
    els.findingsTable.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-copy-path]')
      if (!button) {
        return
      }
      try {
        await clipboard.writeText(button.dataset.copyPath)
        operations.showToast('Path copied')
      } catch {
        operations.showToast('Unable to copy path')
      }
    })
  }

  function bindGraphFilters() {
    for (const element of [els.orphansOnly, els.uncoveredOnly, els.reviewOnly, els.findingsOnly, els.hideAuxiliary]) {
      element.addEventListener('change', operations.applyFilters)
    }
    els.typeChecks.addEventListener('change', (event) => {
      const type = event.target.dataset.type
      if (!type) {
        return
      }
      if (event.target.checked) {
        state.selectedTypes.add(type)
      } else {
        state.selectedTypes.delete(type)
      }
      operations.applyFilters()
    })
    els.graphFilterBtn.addEventListener('click', (event) => {
      event.stopPropagation()
      const open = !els.graphFilterPanel.classList.contains('hidden')
      els.graphFilterPanel.classList.toggle('hidden', open)
      els.graphFilterBtn.classList.toggle('active', !open)
    })
    els.graphFilterPanel.addEventListener('click', (event) => event.stopPropagation())
    els.graphFilterPanel.addEventListener('pointerdown', (event) => event.stopPropagation())
    els.graphSearch.addEventListener('input', operations.debounce(operations.applyFilters, 180))
  }

  function bindDocument() {
    document.addEventListener('click', (event) => {
      const traceToggle = event.target.closest('[data-toggle-trace]')
      if (traceToggle) {
        event.stopPropagation()
        state.showAllTrace = !state.showAllTrace
        operations.render()
        operations.renderModuleDetail()
        return
      }
      const pick = event.target.closest('[data-pick]')
      if (pick) {
        operations.selectNode(pick.dataset.pick)
      }
      closeWhenOutside(els.filterPanel, els.filterBtn, event.target)
      closeWhenOutside(els.graphFilterPanel, els.graphFilterBtn, event.target)
      if (!els.statsPopover.contains(event.target) && event.target !== els.metaPill) {
        els.statsPopover.classList.add('hidden')
      }
      if (!els.actionsMenu.contains(event.target) && event.target !== els.actionsBtn) {
        els.actionsMenu.classList.add('hidden')
      }
    })
  }

  function closeWhenOutside(panel, button, target) {
    if (!panel.contains(target) && target !== button) {
      panel.classList.add('hidden')
      button.classList.remove('active')
    }
  }

  function bindActions() {
    els.metaPill.addEventListener('click', (event) => {
      event.stopPropagation()
      els.statsPopover.classList.toggle('hidden')
    })
    els.actionsBtn.addEventListener('click', (event) => {
      event.stopPropagation()
      els.actionsMenu.classList.toggle('hidden')
    })
    els.refreshBtn.addEventListener('click', operations.refreshGraph)
    els.exportBtn.addEventListener('click', operations.exportGraph)
    els.createTraceSubmapBtn.addEventListener('click', operations.createTraceSubmap)
    els.zoomInBtn.addEventListener('click', () => operations.setZoom(state.zoom + 0.15))
    els.zoomOutBtn.addEventListener('click', () => operations.setZoom(state.zoom - 0.15))
    els.zoomResetBtn.addEventListener('click', operations.resetZoom)
    els.importFile.addEventListener('change', (event) => {
      const file = event.target.files[0]
      if (file) {
        operations.importGraph(file)
      }
    })
    for (const [element, view] of [
      [els.tabOverview, 'overview'],
      [els.tabGraph, 'graph'],
      [els.tabDomain, 'domain'],
      [els.tabFindings, 'findings'],
      [els.tabSettings, 'settings']
    ]) {
      element.addEventListener('click', () => changeView(view))
    }
    els.settingsSaveBtn.addEventListener('click', operations.saveConfig)
    els.settingsExportBtn.addEventListener('click', operations.exportProjectMap)
    els.settingsImportFile.addEventListener('change', (event) => {
      const file = event.target.files[0]
      if (file) {
        operations.importProjectMap(file)
      }
    })
  }

  function bind() {
    if (bound) {
      return false
    }
    bound = true
    bindWheelZoom(els.canvasWrap)
    bindPanDrag(els.canvasWrap)
    bindNodeClick(els.graph)
    bindOverview()
    bindGraphFilters()
    bindDocument()
    bindActions()
    return true
  }

  return Object.freeze({
    bind,
    start() {
      if (!startPromise) {
        operations.updateViewUI()
        bind()
        startPromise = Promise.resolve().then(() => operations.loadGraph())
      }
      return startPromise
    }
  })
}

export function assertViewerUiDependencies(dependencies) {
  if (!dependencies || typeof dependencies !== 'object') {
    throw new TypeError('Viewer UI dependencies must be an object')
  }
  const { state, elements, document, browser, clipboard, operations } = dependencies
  if (!state || typeof state !== 'object') {
    throw new TypeError('Viewer UI state must be an object')
  }
  if (!elements || typeof elements !== 'object') {
    throw new TypeError('Viewer UI elements must be an object')
  }
  for (const name of INTERACTIVE_ELEMENT_NAMES) {
    if (!elements[name] || typeof elements[name].addEventListener !== 'function') {
      throw new TypeError(`Viewer UI element ${name} must support addEventListener()`)
    }
  }
  if (!elements.canvasWrap || typeof elements.canvasWrap.addEventListener !== 'function') {
    throw new TypeError('Viewer UI element canvasWrap must support addEventListener()')
  }
  for (const [name, capability] of [
    ['document', document],
    ['browser', browser]
  ]) {
    if (!capability || typeof capability !== 'object') {
      throw new TypeError(`Viewer UI ${name} capability must be an object`)
    }
  }
  if (typeof document.addEventListener !== 'function') {
    throw new TypeError('Viewer UI document must support addEventListener()')
  }
  for (const operation of ['setTimeout', 'clearTimeout']) {
    if (typeof browser[operation] !== 'function') {
      throw new TypeError(`Viewer UI browser must implement ${operation}()`)
    }
  }
  if (!clipboard || typeof clipboard.writeText !== 'function') {
    throw new TypeError('Viewer UI clipboard must implement writeText()')
  }
  if (!operations || typeof operations !== 'object') {
    throw new TypeError('Viewer UI operations must be an object')
  }
  for (const name of OPERATION_NAMES) {
    if (typeof operations[name] !== 'function') {
      throw new TypeError(`Viewer UI operations must implement ${name}()`)
    }
  }
  return dependencies
}
