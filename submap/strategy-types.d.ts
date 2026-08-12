import type { MapEdge, MapNode } from './graph-types.d.ts'
import type { AccessLevel, NormalizedSubmapSelector, TraversalDirection } from './submap-types.d.ts'

export interface SelectionStrategy {
  readonly id?: string
  select(input: { nodes: MapNode[]; selector: NormalizedSubmapSelector }): Set<string>
}

export interface TraversalStrategy {
  readonly id?: string
  traverse(input: {
    seeds: Set<string>
    edges: MapEdge[]
    policy: {
      direction: TraversalDirection
      maxDepth: number
      edgeTypes: string[]
      excludedEdgeTypes: string[]
    }
    excludedIds: Set<string>
    blockedIds: Set<string>
  }): { eligibleEdges: MapEdge[]; includedIds: Set<string> }
}

export interface AccessStrategy {
  readonly id?: string
  resolve(input: {
    nodes: MapNode[]
    rules: Record<AccessLevel, NormalizedSubmapSelector> & { default: AccessLevel }
    matches: Record<AccessLevel, Set<string>>
  }): Record<AccessLevel, string[]> & { default: AccessLevel }
}

export interface SubmapStrategies {
  selection: SelectionStrategy
  traversal: TraversalStrategy
  access: AccessStrategy
}
