export type TraversalDirection = 'incoming' | 'outgoing' | 'both'
export type AccessLevel = 'editable' | 'readable' | 'external' | 'forbidden' | 'generated'

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
  version: number
  generatedAt?: string
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

export interface SubmapRepository {
  read(filePath: string): Submap
  list(directory: string): string[]
  write(filePath: string, submap: Submap, options?: { force?: boolean }): string
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

export function createSubmap(
  graph: CodeMapGraph,
  request: SubmapRequest,
  options?: {
    createdAt?: string
    git?: Record<string, unknown>
    clock?: { nowIso(): string }
    hash?: { sha256(value: string): string }
    strategies?: Partial<SubmapStrategies>
  }
): Submap
export function validateSubmap(submap: Submap, options?: { hash?: { sha256(value: string): string } }): ValidationResult
export function validateSubmapAgainstGraph(
  submap: Submap,
  graph: CodeMapGraph,
  options?: { hash?: { sha256(value: string): string } }
): ValidationResult
export function compareSubmaps(previous: Submap, current: Submap): Record<string, unknown>
export function inspectSubmap(submap: Submap): Record<string, unknown>
export function calculateGraphDigest(graph: CodeMapGraph, hash?: { sha256(value: string): string }): string
export function calculateSubmapUid(submap: Submap, hash?: { sha256(value: string): string }): string
export function canonicalStringify(value: unknown): string
export const defaultSelectionStrategy: SelectionStrategy
export const defaultTraversalStrategy: TraversalStrategy
export const defaultAccessStrategy: AccessStrategy
export function resolveSubmapStrategies(strategies?: Partial<SubmapStrategies>): Readonly<SubmapStrategies>
export function normalizeRequest(request: SubmapRequest): SubmapRequest
export function globMatches(pattern: string, value: string): boolean
export const ACCESS_LEVELS: AccessLevel[]
export function readJson(filePath: string, kind?: string): any
export function readJsonStdin(): any
export function readGraph(filePath: string): CodeMapGraph
export function readSubmap(filePath: string): Submap
export function writeSubmap(filePath: string, submap: Submap, options?: { force?: boolean }): string
export function writeJsonAtomic(filePath: string, value: unknown, options?: { force?: boolean }): string
export function defaultSubmapFilename(submap: Submap): string
export function listSubmapFiles(directory: string): string[]
export const nodeSubmapRepository: Readonly<SubmapRepository>
export const submapRepositoryContract: readonly ['read', 'list', 'write']
export function assertSubmapRepository(repository: unknown): SubmapRepository

export class SubmapError extends Error {
  code: string
  details: Record<string, unknown>
  exitCode: number
}
