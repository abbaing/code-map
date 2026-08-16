export function bindSelectionContextMenu(context) {
  const { canvasWrap, selectionContextMenu: menu } = context.elements
  let contextNodeId = null
  canvasWrap.addEventListener('contextmenu', (event) => {
    const nodeId = event.target.closest('.node')?.dataset.id ?? null
    if (!canOpen(context.state.subgraphNodeIds, nodeId)) {
      return
    }
    event.preventDefault()
    contextNodeId = nodeId
    positionMenu(menu, canvasWrap, event.clientX, event.clientY)
    context.elements.selectionContextRemoveBtn.classList.toggle('hidden', !nodeId)
    menu.classList.remove('hidden')
  })
  bindMenuActions(context, menu, () => contextNodeId)
}

function bindMenuActions(context, menu, contextNodeId) {
  const close = () => menu.classList.add('hidden')
  context.elements.selectionContextCreateBtn.addEventListener('click', () => {
    close()
    void context.operations.createSelectionSubmap()
  })
  context.elements.selectionContextExportBtn.addEventListener('click', () => {
    close()
    context.operations.exportSubgraphSelection()
  })
  context.elements.selectionContextRemoveBtn.addEventListener('click', () => {
    const nodeId = contextNodeId()
    if (nodeId) {
      context.operations.toggleSubgraphNode(nodeId)
    }
    close()
  })
  context.elements.selectionContextClearBtn.addEventListener('click', () => {
    context.operations.clearSubgraphSelection()
    close()
  })
}

function canOpen(selectedNodeIds, contextNodeId) {
  return selectedNodeIds.size > 0 && (!contextNodeId || selectedNodeIds.has(contextNodeId))
}

function positionMenu(menu, canvas, clientX, clientY) {
  const canvasBounds = canvas.getBoundingClientRect()
  const width = menu.offsetWidth || 200
  const height = menu.offsetHeight || 150
  const left = Math.min(clientX - canvasBounds.left, Math.max(8, canvasBounds.width - width - 8))
  const top = Math.min(clientY - canvasBounds.top, Math.max(8, canvasBounds.height - height - 8))
  Object.assign(menu.style, { left: `${Math.max(8, left)}px`, top: `${Math.max(8, top)}px` })
}
