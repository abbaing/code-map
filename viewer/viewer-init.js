function bindWheelZoom(canvas) {
  const debouncedZoom = debounce((zoom, x, y) => zoomAt(zoom, x, y), 20)
  canvas.addEventListener('wheel', event => {
    event.preventDefault()
    const step = event.deltaY > 0 ? -0.12 : 0.12
    debouncedZoom(state.zoom + step, event.clientX, event.clientY)
  }, { passive: false })
}

function bindPanDrag(canvas) {
  let dragging = false
  let pointerId = null
  let startX = 0
  let startY = 0
  let startPanX = 0
  let startPanY = 0

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return
    if (event.target.closest('.node')) return
    if (event.target.closest('#moduleDetail')) return
    if (event.target.closest('button, label, input')) return
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

  canvas.addEventListener('pointermove', event => {
    if (!dragging) return
    const deltaX = event.clientX - startX
    const deltaY = event.clientY - startY
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) state.dragMoved = true
    state.panX = startPanX - deltaX / state.zoom
    state.panY = startPanY - deltaY / state.zoom
    applyPan()
    event.preventDefault()
  })

  canvas.addEventListener('pointerup', event => {
    const shouldClearSelection = dragging
      && !state.dragMoved
      && !event.target.closest('.node')
    const shouldSuppressClickReset = dragging && state.dragMoved

    dragging = false
    canvas.classList.remove('dragging')
    if (pointerId !== null && canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId)
    }
    pointerId = null
    if (shouldClearSelection) clearSelectedNode()
    if (shouldSuppressClickReset) state.suppressOutsideReset = true
    window.setTimeout(() => {
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

  svg.addEventListener('click', event => {
    if (state.dragMoved || state.suppressOutsideReset) return
    const nodeEl = event.target.closest('.node')
    if (!nodeEl) {
      clearTimeout(clickTimer)
      lastClickedId = null
      clearSelectedNode()
      return
    }
    const id = nodeEl.dataset.id
    if (id === lastClickedId) {
      clearTimeout(clickTimer)
      lastClickedId = null
      const node = state.graph.nodes.find(n => n.id === id)
      if (!node?.path) return
      els.findingsSearch.value = node.path
      state.view = 'findings'
      state.activeModule = null
      updateViewUI()
      applyFilters()
      return
    }
    lastClickedId = id
    clickTimer = setTimeout(() => {
      selectNode(id)
      lastClickedId = null
    }, 250)
  })
}

function bindCanvasInteractions() {
  bindWheelZoom(els.canvasWrap)
  bindPanDrag(els.canvasWrap)
  bindNodeClick(els.graph)
}

// ── event bindings ────────────────────────────────────────────────────────────

// ── overview interactions ─────────────────────────────────────────────────────

els.overviewScroll.addEventListener('click', event => {
  const card = event.target.closest('.module-card')
  if (card) drillIntoModule(card.dataset.module)
})

const debouncedApplyFilters = debounce(applyFilters, 180)

els.search.addEventListener('input', debouncedApplyFilters)
els.healthChecks.addEventListener('change', event => {
  const key = event.target.dataset.health
  if (!key) return
  if (event.target.checked) state.selectedHealth.add(key)
  else state.selectedHealth.delete(key)
  applyFilters()
})
els.filterBtn.addEventListener('click', event => {
  event.stopPropagation()
  const open = !els.filterPanel.classList.contains('hidden')
  els.filterPanel.classList.toggle('hidden', open)
  els.filterBtn.classList.toggle('active', !open)
})
els.filterPanel.addEventListener('click', event => event.stopPropagation())

// findings interactions
els.findingsSearch.addEventListener('input', debouncedApplyFilters)
els.findingsSeverity.addEventListener('change', applyFilters)
els.findingsRule.addEventListener('change', applyFilters)
els.findingsModule.addEventListener('change', applyFilters)

// ── graph/domain interactions ─────────────────────────────────────────────────

els.orphansOnly.addEventListener('change', applyFilters)
els.uncoveredOnly.addEventListener('change', applyFilters)
els.reviewOnly.addEventListener('change', applyFilters)
els.findingsOnly.addEventListener('change', applyFilters)
els.hideAuxiliary.addEventListener('change', applyFilters)
els.typeChecks.addEventListener('change', event => {
  const type = event.target.dataset.type
  if (!type) return
  if (event.target.checked) state.selectedTypes.add(type)
  else state.selectedTypes.delete(type)
  applyFilters()
})
els.graphFilterBtn.addEventListener('click', event => {
  event.stopPropagation()
  const open = !els.graphFilterPanel.classList.contains('hidden')
  els.graphFilterPanel.classList.toggle('hidden', open)
  els.graphFilterBtn.classList.toggle('active', !open)
})
els.graphFilterPanel.addEventListener('click', event => event.stopPropagation())
els.graphFilterPanel.addEventListener('pointerdown', event => event.stopPropagation())

// ── shared ────────────────────────────────────────────────────────────────────

document.addEventListener('click', event => {
  const pick = event.target.closest('[data-pick]')
  if (pick) selectNode(pick.dataset.pick)
  if (!pick
    && !state.suppressOutsideReset
    && !event.target.closest('.node')
    && !event.target.closest('#moduleDetail')) clearSelectedNode()
  if (!els.filterPanel.contains(event.target) && event.target !== els.filterBtn) {
    els.filterPanel.classList.add('hidden')
    els.filterBtn.classList.remove('active')
  }
  if (!els.graphFilterPanel.contains(event.target) && event.target !== els.graphFilterBtn) {
    els.graphFilterPanel.classList.add('hidden')
    els.graphFilterBtn.classList.remove('active')
  }
  if (!els.statsPopover.contains(event.target) && event.target !== els.metaPill)
    els.statsPopover.classList.add('hidden')
  if (!els.actionsMenu.contains(event.target) && event.target !== els.actionsBtn)
    els.actionsMenu.classList.add('hidden')
})

els.metaPill.addEventListener('click', event => { event.stopPropagation(); els.statsPopover.classList.toggle('hidden') })
els.actionsBtn.addEventListener('click', event => { event.stopPropagation(); els.actionsMenu.classList.toggle('hidden') })
els.refreshBtn.addEventListener('click', refreshGraph)
els.exportBtn.addEventListener('click', exportGraph)
els.zoomInBtn.addEventListener('click', () => setZoom(state.zoom + 0.15))
els.zoomOutBtn.addEventListener('click', () => setZoom(state.zoom - 0.15))
els.zoomResetBtn.addEventListener('click', resetZoom)
els.importFile.addEventListener('change', event => { const file = event.target.files[0]; if (file) importGraph(file) })
els.tabOverview.addEventListener('click', () => { state.view = 'overview'; state.activeModule = null; updateViewUI(); applyFilters() })
els.tabGraph.addEventListener('click',    () => { state.view = 'graph';    state.activeModule = null; updateViewUI(); applyFilters() })
els.tabDomain.addEventListener('click',   () => { state.view = 'domain';   state.activeModule = null; state.panX = 0; state.panY = 0; updateViewUI(); applyFilters() })
els.tabFindings.addEventListener('click', () => { state.view = 'findings'; state.activeModule = null; updateViewUI(); applyFilters() })
els.tabSettings.addEventListener('click', () => { state.view = 'settings'; state.activeModule = null; updateViewUI(); populateSettingsTab() })
els.settingsSaveBtn.addEventListener('click', saveConfig)
els.settingsExportBtn.addEventListener('click', exportProjectMap)
els.settingsImportFile.addEventListener('change', event => { const file = event.target.files[0]; if (file) importProjectMap(file) })

// ── boot ──────────────────────────────────────────────────────────────────────

updateViewUI()
bindCanvasInteractions()

loadGraph().catch(error => {
  els.status.textContent = `Error: ${error.message}`
})
