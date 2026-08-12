import { buildDomainClusters } from '#viewer/viewer-layout-domain-clusters.js'
import { forcePlaceDomainCluster } from '#viewer/viewer-layout-domain-force.js'
import { gridPlaceDomainCluster } from '#viewer/viewer-layout-domain-grid.js'
import { computeDomainOrder } from '#viewer/viewer-layout-domain-order.js'
import { nodeHeight } from '#viewer/viewer-trace.js'

export function layoutDomainNodes(nodes, width, height) {
  const clusters = buildDomainClusters(nodes, computeDomainOrder(nodes))
  const metrics = { left: 140, top: 54, cardWidth: 260, clusterGap: 90, targetWidth: Math.max(width, 4200) }
  const result = []
  const moduleLabels = []
  const cursor = { x: metrics.left, y: metrics.top, rowBottom: metrics.top, contentRight: metrics.left }
  for (const cluster of clusters) {
    positionCluster(cluster, cursor, metrics, result, moduleLabels)
  }
  return {
    nodes: result,
    width: Math.max(width, cursor.contentRight + 40),
    height: Math.max(height, cursor.rowBottom + 50),
    layerLabels: [
      { layer: 'domain', x: metrics.left, width: Math.max(width, cursor.contentRight + 40) - metrics.left, levels: [] }
    ],
    moduleLabels
  }
}

function positionCluster(cluster, cursor, metrics, result, labels) {
  const placement =
    cluster.degree > 0
      ? forcePlaceDomainCluster(cluster, metrics.cardWidth)
      : gridPlaceDomainCluster(cluster, metrics.cardWidth, 80, 80)
  const clusterWidth = placement.width + 32
  const clusterHeight = placement.height + 70
  if (cursor.x > metrics.left && cursor.x + clusterWidth > metrics.targetWidth) {
    cursor.x = metrics.left
    cursor.y = cursor.rowBottom + metrics.clusterGap
  }
  labels.push({
    module: cluster.key,
    label: cluster.label,
    x: cursor.x,
    width: clusterWidth,
    labelX: cursor.x + 16,
    y: cursor.y + 18,
    height: clusterHeight
  })
  for (const node of cluster.nodes) {
    const position = placement.positions.get(node.id)
    result.push({
      ...node,
      x: cursor.x + 16 + position.x,
      y: cursor.y + 48 + position.y,
      layoutLayer: 'domain',
      level: 0,
      width: metrics.cardWidth,
      height: nodeHeight(node, 'domain')
    })
  }
  cursor.contentRight = Math.max(cursor.contentRight, cursor.x + clusterWidth)
  cursor.rowBottom = Math.max(cursor.rowBottom, cursor.y + clusterHeight)
  cursor.x += clusterWidth + metrics.clusterGap
}
