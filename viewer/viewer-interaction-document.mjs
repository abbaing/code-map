export function bindDocumentNavigation({ elements, state, document, operations }) {
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
    closeWhenOutside(elements.filterPanel, elements.filterBtn, event.target)
    closeWhenOutside(elements.graphFilterPanel, elements.graphFilterBtn, event.target)
    if (!elements.statsPopover.contains(event.target) && event.target !== elements.metaPill) {
      elements.statsPopover.classList.add('hidden')
    }
    if (!elements.actionsMenu.contains(event.target) && event.target !== elements.actionsBtn) {
      elements.actionsMenu.classList.add('hidden')
    }
  })
}

function closeWhenOutside(panel, button, target) {
  if (!panel.contains(target) && target !== button) {
    panel.classList.add('hidden')
    button.classList.remove('active')
  }
}
