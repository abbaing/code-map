import type { MapEdge, MapFinding, MapNode } from './graph-types.d.ts'

export type TraversalDirection = 'incoming' | 'outgoing' | 'both'
export type AccessLevel = 'editable' | 'readable' | 'external' | 'forbidden' | 'generated'

export interface SubmapSelector {
  nodeIds?: string[]
  nodes?: string[]
  paths?: string[]
  modules?: string[]
  layers?: string[]
  types?: string[]
}

export interface NormalizedSubmapSelector {
  nodeIds: string[]
  paths: string[]
  modules: string[]
  layers: string[]
  types: string[]
}

export interface SubmapRequest {
  id: string
  revision?: number
  parentUid?: string | null
  selectors: SubmapSelector
  traversal?: {
    direction?: TraversalDirection
    maxDepth?: number
    edgeTypes?: string[]
    excludedEdgeTypes?: string[]
  }
  exclusions?: SubmapSelector
  access?: Partial<Record<AccessLevel, SubmapSelector>> & { default?: AccessLevel }
  metadata?: Record<string, unknown>
}

export interface SubmapBoundary {
  edgeId: string
  insideNodeId: string
  direction: 'incoming' | 'outgoing'
  outsideNode: Pick<MapNode, 'id' | 'label' | 'type' | 'layer' | 'module' | 'path'>
  reason: 'excluded' | 'depth-limit'
}

export interface Submap {
  kind: 'code-map/submap'
  schemaVersion: 1
  id: string
  uid: string
  revision: number
  parentUid: string | null
  createdAt: string
  source: {
    graphVersion: number
    graphDigest: string
    graphGeneratedAt?: string
    projectName: string
    git?: Record<string, unknown>
  }
  selection: Record<string, unknown>
  access: Record<AccessLevel, string[]> & { default: AccessLevel }
  nodes: MapNode[]
  edges: MapEdge[]
  findings: MapFinding[]
  orphanNodeIds: string[]
  boundaries: SubmapBoundary[]
  catalog: Record<string, unknown>
  statistics: Record<string, number>
  warnings: string[]
  metadata: Record<string, unknown>
}

export interface ValidationIssue {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}
