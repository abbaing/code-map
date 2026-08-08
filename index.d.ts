import type { CodeMapGraph, MapEdge, MapNode } from './submap/index.js'
export * from './submap/index.js'

export class Graph {
  addNode(id: string, data: Partial<MapNode>): void
  addEdge(from: string, to: string, type: string, data?: Partial<MapEdge>): void
  getNode(id: string): MapNode | undefined
  getEdge(id: string): MapEdge | undefined
  hasNode(id: string): boolean
  allNodes(): MapNode[]
  allEdges(): MapEdge[]
  clear(): void
}

export function writeGraph(outputPath?: string): CodeMapGraph
