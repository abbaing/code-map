import type { CodeMapGraph, MapEdge, MapNode } from './submap/index.js'
export * from './submap/index.js'

export interface ProjectMap {
  readonly schemaVersion: number
  readonly project: {
    readonly name: string
    readonly graphOutput: string
    readonly submapsDirectory: string
    readonly runtimeLinks?: string
  }
  readonly sourceRoots: {
    readonly frontend: string
    readonly backend?: string
  }
  readonly templates: {
    readonly enabled: readonly string[]
    readonly plugins?: readonly string[]
  }
  readonly ignoredDirs: readonly string[]
  readonly imports: {
    readonly aliases: ReadonlyArray<{ readonly prefix: string; readonly path: string }>
  }
  readonly modules: Readonly<Record<string, unknown>>
  readonly layers: ReadonlyArray<Readonly<Record<string, unknown>>>
  readonly types: Readonly<Record<string, unknown>>
  readonly frontend: Readonly<Record<string, unknown>>
  readonly backend: Readonly<Record<string, unknown>>
  readonly rules: Readonly<Record<string, unknown>>
  readonly configPath?: string
  readonly [key: string]: unknown
}

export interface ProjectContext {
  readonly repoRoot: string
  readonly configPath: string | null
  readonly projectMap: ProjectMap
  resolveRepoPath(repoPath: string): string
  toRepoPath(filePath: string): string
  resolveGraphOutputPath(outputPath?: string): string
}

export interface ProjectContextOptions {
  repoRoot?: string
  configPath?: string | null
}

export interface LoadProjectContextOptions {
  repoRoot?: string
  argv?: string[]
  env?: Record<string, string | undefined>
}

export function createProjectContext(
  projectMap: Record<string, unknown>,
  options?: ProjectContextOptions
): ProjectContext
export function loadProjectContext(
  source?: string | Record<string, unknown>,
  options?: LoadProjectContextOptions
): ProjectContext

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

export function writeGraph(outputPath?: string, projectContext?: ProjectContext): CodeMapGraph
