import { assertViewerUiDependencies } from '#viewer/viewer-interaction-contracts.mjs'
import { bindViewerFilters } from '#viewer/viewer-interaction-filters.mjs'
import { bindViewerNavigation } from '#viewer/viewer-interaction-navigation.mjs'
import { bindPointerNavigation } from '#viewer/viewer-interaction-pointer.mjs'

export function createViewerUiController(dependencies) {
  const context = assertViewerUiDependencies(dependencies)
  let bound = false
  let startPromise = null

  function changeView(view) {
    context.state.view = view
    context.state.activeModule = null
    if (view === 'domain') {
      context.state.panX = 0
      context.state.panY = 0
    }
    context.operations.updateViewUI()
    if (view === 'settings') {
      context.operations.populateSettingsTab()
    } else {
      context.operations.applyFilters()
    }
  }

  function bind() {
    if (bound) {
      return false
    }
    bound = true
    bindPointerNavigation(context, changeView)
    bindViewerFilters(context)
    bindViewerNavigation(context, changeView)
    return true
  }

  return Object.freeze({
    bind,
    start() {
      if (!startPromise) {
        context.operations.updateViewUI()
        bind()
        startPromise = Promise.resolve().then(() => context.operations.loadGraph())
      }
      return startPromise
    }
  })
}

export { assertViewerUiDependencies }
