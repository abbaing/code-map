export function bindRectangleSelection(context) {
  const canvas = context.elements.canvasWrap
  const drag = { active: false, moved: false, pointerId: null }
  canvas.addEventListener('pointerdown', (event) => startSelection(event, canvas, drag))
  canvas.addEventListener('pointermove', (event) => moveSelection(event, context.elements.selectionBox, drag))
  canvas.addEventListener('pointerup', (event) => finishSelection(event, context, drag))
  canvas.addEventListener('pointercancel', () => cancelSelection(context, drag))
}

export function idsInsideRectangle(nodeElements, bounds) {
  return [...nodeElements]
    .filter((element) => pointInside(centerOf(element.getBoundingClientRect()), bounds))
    .map((element) => element.dataset.id)
    .filter(Boolean)
}

function startSelection(event, canvas, drag) {
  if (event.button !== 0 || event.altKey || isInteractive(event.target)) {
    return
  }
  Object.assign(drag, {
    active: true,
    moved: false,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    currentX: event.clientX,
    currentY: event.clientY
  })
  canvas.setPointerCapture(event.pointerId)
  event.preventDefault()
}

function moveSelection(event, selectionBox, drag) {
  if (!drag.active) {
    return
  }
  drag.currentX = event.clientX
  drag.currentY = event.clientY
  drag.moved = drag.moved || Math.abs(drag.currentX - drag.startX) > 2 || Math.abs(drag.currentY - drag.startY) > 2
  if (drag.moved) {
    showSelectionBox(selectionBox, rectangle(drag.startX, drag.startY, drag.currentX, drag.currentY))
  }
  event.preventDefault()
}

function finishSelection(event, context, drag) {
  if (!drag.active) {
    return
  }
  if (drag.moved) {
    const bounds = rectangle(drag.startX, drag.startY, event.clientX, event.clientY)
    const nodes = context.elements.graph.querySelectorAll('.node[data-id]')
    context.operations.replaceSubgraphSelection(idsInsideRectangle(nodes, bounds))
    context.state.suppressOutsideReset = true
  } else {
    context.operations.clearSubgraphSelection()
    context.operations.clearSelectedNode()
  }
  releaseSelection(context, drag)
}

function cancelSelection(context, drag) {
  if (drag.active) {
    releaseSelection(context, drag)
  }
}

function releaseSelection(context, drag) {
  const canvas = context.elements.canvasWrap
  context.elements.selectionBox.classList.add('hidden')
  if (canvas.hasPointerCapture(drag.pointerId)) {
    canvas.releasePointerCapture(drag.pointerId)
  }
  Object.assign(drag, { active: false, moved: false, pointerId: null })
  context.browser.setTimeout(() => {
    context.state.suppressOutsideReset = false
  }, 250)
}

function showSelectionBox(element, bounds) {
  const canvasBounds = element.parentElement.getBoundingClientRect()
  Object.assign(element.style, {
    left: `${bounds.left - canvasBounds.left}px`,
    top: `${bounds.top - canvasBounds.top}px`,
    width: `${bounds.right - bounds.left}px`,
    height: `${bounds.bottom - bounds.top}px`
  })
  element.classList.remove('hidden')
}

function rectangle(startX, startY, endX, endY) {
  return {
    left: Math.min(startX, endX),
    top: Math.min(startY, endY),
    right: Math.max(startX, endX),
    bottom: Math.max(startY, endY)
  }
}

function centerOf(bounds) {
  return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
}

function pointInside(point, bounds) {
  return point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom
}

function isInteractive(target) {
  return target.closest('.node, #moduleDetail, button, label, input')
}
