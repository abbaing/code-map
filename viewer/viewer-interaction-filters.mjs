export function bindViewerFilters(context) {
  bindOverviewFilters(context)
  bindFindingFilters(context)
  bindGraphFilters(context)
}

function bindOverviewFilters({ elements, state, operations }) {
  elements.overviewScroll.addEventListener('click', (event) => {
    const card = event.target.closest('.module-card')
    if (card) {
      operations.drillIntoModule(card.dataset.module)
    }
  })
  const applyFilters = operations.debounce(operations.applyFilters, 180)
  elements.search.addEventListener('input', applyFilters)
  elements.healthChecks.addEventListener('change', (event) => {
    updateSelection(state.selectedHealth, event.target.dataset.health, event.target.checked)
    if (event.target.dataset.health) {
      operations.applyFilters()
    }
  })
  bindFilterPanel(elements.filterBtn, elements.filterPanel)
}

function bindFindingFilters({ elements, clipboard, operations }) {
  const applyFilters = operations.debounce(operations.applyFilters, 180)
  elements.findingsSearch.addEventListener('input', applyFilters)
  for (const element of [elements.findingsSeverity, elements.findingsRule, elements.findingsModule]) {
    element.addEventListener('change', operations.applyFilters)
  }
  elements.findingsTable.addEventListener('click', async (event) => {
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

function bindGraphFilters({ elements, state, operations }) {
  const booleans = [
    elements.orphansOnly,
    elements.uncoveredOnly,
    elements.reviewOnly,
    elements.findingsOnly,
    elements.hideAuxiliary
  ]
  for (const element of booleans) {
    element.addEventListener('change', operations.applyFilters)
  }
  elements.typeChecks.addEventListener('change', (event) => {
    updateSelection(state.selectedTypes, event.target.dataset.type, event.target.checked)
    if (event.target.dataset.type) {
      operations.applyFilters()
    }
  })
  bindFilterPanel(elements.graphFilterBtn, elements.graphFilterPanel, true)
  elements.graphSearch.addEventListener('input', operations.debounce(operations.applyFilters, 180))
}

function bindFilterPanel(button, panel, stopPointer = false) {
  button.addEventListener('click', (event) => {
    event.stopPropagation()
    const open = !panel.classList.contains('hidden')
    panel.classList.toggle('hidden', open)
    button.classList.toggle('active', !open)
  })
  panel.addEventListener('click', (event) => event.stopPropagation())
  if (stopPointer) {
    panel.addEventListener('pointerdown', (event) => event.stopPropagation())
  }
}

function updateSelection(selection, key, selected) {
  if (!key) {
    return
  }
  if (selected) {
    selection.add(key)
  } else {
    selection.delete(key)
  }
}
