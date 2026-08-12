export interface MapNode {
  id: string
  label: string
  type: string
  layer: string
  module: string
  path?: string
  meta?: Record<string, unknown>
  [key: string]: unknown
}

export interface MapEdge {
  id: string
  from: string
  to: string
  type: string
  label?: string
  confidence?: string
  source?: string
  evidence?: string
  [key: string]: unknown
}

export interface MapFinding {
  id: string
  ruleId: string
  severity: string
  message: string
  nodeId?: string
  path?: string
  line?: number
  [key: string]: unknown
}

export interface CodeMapGraph {
  version: 1
  generatedAt: string
  stats: { nodes: number; edges: number; [key: string]: unknown }
  projectMap?: Record<string, any>
  nodes: MapNode[]
  edges: MapEdge[]
  findings?: MapFinding[]
  suppressedFindings?: MapFinding[]
  orphans?: Array<MapNode | string>
  templates?: string[]
  architecture?: Array<Record<string, unknown>>
  ruleMetadata?: Record<string, Record<string, unknown>>
  [key: string]: unknown
}
