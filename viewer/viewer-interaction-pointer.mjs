import { bindRectangleSelection } from '#viewer/viewer-interaction-selection.mjs'

export function bindPointerNavigation(context, changeView) {
  bindWheelZoom(context)
  bindPanDrag(context)
  bindRectangleSelection(context)
  bindNodeClick(context, changeView)
}

function bindWheelZoom({ elements, state, operations }) {
  const zoom = operations.debounce((value, x, y) => operations.zoomAt(value, x, y), 20)
  elements.canvasWrap.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault()
      zoom(state.zoom + (event.deltaY > 0 ? -0.12 : 0.12), event.clientX, event.clientY)
    },
    { passive: false }
  )
}

function bindPanDrag(context) {
  const canvas = context.elements.canvasWrap
  const drag = { active: false, pointerId: null }
  canvas.addEventListener('pointerdown', (event) => startDrag(event, canvas, context.state, drag))
  canvas.addEventListener('pointermove', (event) => moveDrag(event, context, drag))
  canvas.addEventListener('pointerup', (event) => finishDrag(event, canvas, context, drag))
  canvas.addEventListener('pointercancel', () => cancelDrag(canvas, context.state, drag))
}

function startDrag(event, canvas, state, drag) {
  const interactive =
    event.target.closest('.node') ||
    event.target.closest('#moduleDetail') ||
    event.target.closest('button, label, input')
  const panPointer = event.button === 1 || (event.button === 0 && event.altKey)
  if (!panPointer || interactive) {
    return
  }
  Object.assign(drag, {
    active: true,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startPanX: state.panX,
    startPanY: state.panY
  })
  state.dragMoved = false
  canvas.classList.add('dragging')
  canvas.setPointerCapture(drag.pointerId)
  event.preventDefault()
}

function moveDrag(event, context, drag) {
  if (!drag.active) {
    return
  }
  const deltaX = event.clientX - drag.startX
  const deltaY = event.clientY - drag.startY
  if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
    context.state.dragMoved = true
  }
  context.state.panX = drag.startPanX - deltaX / context.state.zoom
  context.state.panY = drag.startPanY - deltaY / context.state.zoom
  context.operations.applyPan()
  event.preventDefault()
}

function finishDrag(event, canvas, context, drag) {
  const clear = drag.active && !context.state.dragMoved && !event.target.closest('.node')
  const suppress = drag.active && context.state.dragMoved
  drag.active = false
  canvas.classList.remove('dragging')
  if (drag.pointerId !== null && canvas.hasPointerCapture(drag.pointerId)) {
    canvas.releasePointerCapture(drag.pointerId)
  }
  drag.pointerId = null
  if (clear) {
    context.operations.clearSelectedNode()
  }
  if (suppress) {
    context.state.suppressOutsideReset = true
  }
  context.browser.setTimeout(() => {
    context.state.dragMoved = false
    context.state.suppressOutsideReset = false
  }, 250)
}

function cancelDrag(canvas, state, drag) {
  Object.assign(drag, { active: false, pointerId: null })
  state.dragMoved = false
  canvas.classList.remove('dragging')
}

function bindNodeClick(context, changeView) {
  let lastClickedId = null
  let clickTimer = null
  context.elements.graph.addEventListener('click', (event) => {
    if (context.state.dragMoved || context.state.suppressOutsideReset) {
      return
    }
    const nodeElement = event.target.closest('.node')
    if (!nodeElement) {
      context.browser.clearTimeout(clickTimer)
      lastClickedId = null
      context.operations.clearSelectedNode()
    } else if ((event.ctrlKey || event.metaKey) && nodeElement.dataset.id) {
      context.browser.clearTimeout(clickTimer)
      lastClickedId = null
      context.operations.toggleSubgraphNode(nodeElement.dataset.id)
    } else if (nodeElement.dataset.module) {
      context.browser.clearTimeout(clickTimer)
      lastClickedId = null
      context.operations.drillIntoModule(nodeElement.dataset.module)
    } else if (nodeElement.dataset.id === lastClickedId) {
      context.browser.clearTimeout(clickTimer)
      lastClickedId = null
      openNodeFindings(context, nodeElement.dataset.id, changeView)
    } else {
      const id = nodeElement.dataset.id
      lastClickedId = id
      clickTimer = context.browser.setTimeout(() => {
        context.operations.selectNode(id)
        lastClickedId = null
      }, 250)
    }
  })
}

function openNodeFindings(context, id, changeView) {
  const node = context.state.graph.nodes.find((candidate) => candidate.id === id)
  if (!node?.path) {
    return
  }
  context.elements.findingsSearch.value = node.path
  changeView('findings')
}
