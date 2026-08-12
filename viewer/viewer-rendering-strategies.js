import {
  createEdgeRendererRegistry,
  createLayoutRegistry,
  createNodeRendererRegistry
} from '#viewer/rendering-contracts.mjs'
import { layoutNodes, layoutSystemModules } from '#viewer/viewer-layouts.js'
import { edgeSvg, nodeDomainSvg, nodeGraphSvg, systemModuleEdgeSvg, systemModuleNodeSvg } from '#viewer/viewer-svg.js'

export const layoutRegistry = createLayoutRegistry([
  { id: 'system', layout: ({ nodes, width, height }) => layoutSystemModules(nodes, width, height) },
  { id: 'graph', layout: ({ nodes, width, height }) => layoutNodes(nodes, width, height) },
  { id: 'domain', layout: ({ nodes, width, height }) => layoutNodes(nodes, width, height) }
])

export const nodeRendererRegistry = createNodeRendererRegistry([
  { id: 'system', render: ({ node }) => systemModuleNodeSvg(node) },
  {
    id: 'graph',
    render: ({ node, orphan, dimmed, focused, managedEntityCount }) =>
      nodeGraphSvg(node, orphan, dimmed, focused, managedEntityCount)
  },
  { id: 'domain', render: ({ node, orphan, dimmed, focused }) => nodeDomainSvg(node, orphan, dimmed, focused) }
])

export const edgeRendererRegistry = createEdgeRendererRegistry([
  { id: 'system', render: ({ edge, nodeById }) => systemModuleEdgeSvg(edge, nodeById) },
  {
    id: 'graph',
    render: ({ edge, nodeById, highlighted, dimmed, focused }) => edgeSvg(edge, nodeById, highlighted, dimmed, focused)
  },
  {
    id: 'domain',
    render: ({ edge, nodeById, highlighted, dimmed, focused }) => edgeSvg(edge, nodeById, highlighted, dimmed, focused)
  }
])

export const renderingStrategies = Object.freeze({
  layouts: layoutRegistry.ids,
  nodes: nodeRendererRegistry.ids,
  edges: edgeRendererRegistry.ids
})
