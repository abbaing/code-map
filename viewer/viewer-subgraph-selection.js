import { render } from '#viewer/viewer-graph.js'
import { state } from '#viewer/viewer-state.js'

export function replaceSubgraphSelection(nodeIds) {
  state.subgraphNodeIds = new Set(nodeIds)
  renderSelection()
}

export function toggleSubgraphNode(nodeId) {
  const selected = new Set(state.subgraphNodeIds)
  if (selected.has(nodeId)) {
    selected.delete(nodeId)
  } else {
    selected.add(nodeId)
  }
  state.subgraphNodeIds = selected
  renderSelection()
}

export function clearSubgraphSelection() {
  if (!state.subgraphNodeIds.size) {
    return
  }
  state.subgraphNodeIds = new Set()
  renderSelection()
}

function renderSelection() {
  if (state.view === 'graph' || state.view === 'domain') {
    render()
  }
}
