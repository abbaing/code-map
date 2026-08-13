import { bindViewerActions } from '#viewer/viewer-interaction-actions.mjs'
import { bindDocumentNavigation } from '#viewer/viewer-interaction-document.mjs'

export function bindViewerNavigation(context, changeView) {
  bindDocumentNavigation(context)
  bindViewerActions(context, changeView)
}
