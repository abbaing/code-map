export function bindViewerShortcuts(context) {
  context.document.addEventListener('keydown', (event) => handleShortcut(event, context))
}

function handleShortcut(event, context) {
  if (event.defaultPrevented || event.altKey) {
    return
  }
  const shortcut = { event, context, key: event.key.toLowerCase(), command: event.ctrlKey || event.metaKey }
  for (const handler of shortcutHandlers) {
    if (handler(shortcut)) {
      return
    }
  }
}

const shortcutHandlers = [selectShortcut, saveShortcut, submitShortcut, escapeShortcut]

function selectShortcut({ event, context, key, command }) {
  if (!command || key !== 'a' || !graphView(context.state) || isEditable(event.target)) {
    return false
  }
  event.preventDefault()
  const operation = event.shiftKey
    ? context.operations.invertVisibleSubgraphSelection
    : context.operations.selectVisibleSubgraphNodes
  operation()
  return true
}

function saveShortcut({ event, context, key, command }) {
  if (!command || key !== 's' || !context.state.activeSubmap || !context.state.subgraphNodeIds.size) {
    return false
  }
  event.preventDefault()
  void context.operations.saveSubmapRevision()
  return true
}

function submitShortcut({ event, context, key, command }) {
  if (!command || key !== 'enter' || !graphView(context.state) || !context.state.subgraphNodeIds.size) {
    return false
  }
  event.preventDefault()
  const operation = context.state.activeSubmap
    ? context.operations.saveSubmapRevision
    : context.operations.createSelectionSubmap
  void operation()
  return true
}

function escapeShortcut({ event, context, key }) {
  if (key !== 'escape' || isEditable(event.target)) {
    return false
  }
  closeOverlayOrSelection(event, context)
  return true
}

function closeOverlayOrSelection(event, { elements, state, operations }) {
  const openSubmapMenu = elements.submapList.querySelectorAll?.('.submap-options[open]')?.[0]
  if (openSubmapMenu) {
    openSubmapMenu.removeAttribute('open')
  } else if (!elements.selectionContextMenu.classList.contains('hidden')) {
    elements.selectionContextMenu.classList.add('hidden')
  } else if (!state.activeSubmap && state.subgraphNodeIds.size) {
    operations.clearSubgraphSelection()
  } else {
    return
  }
  event.preventDefault()
}

function graphView(state) {
  return state.view === 'graph' || state.view === 'domain'
}

function isEditable(target) {
  return Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"]'))
}
