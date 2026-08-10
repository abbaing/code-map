import type { CodeMapGraph, MapEdge, MapNode } from './submap/index.js'
export * from './submap/index.js'

export interface ProjectMap {
  readonly schemaVersion: 1
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
  readonly platform: Platform
  resolveRepoPath(repoPath: string): string
  resolvePathFrom(basePath: string, ...segments: string[]): string
  resolveChildPath(basePath: string, ...segments: string[]): string
  toRepoPath(filePath: string): string
  resolveGraphOutputPath(outputPath?: string): string
}

export interface ProjectContextOptions {
  repoRoot?: string
  configPath?: string | null
  platform?: Platform
}

export interface LoadProjectContextOptions {
  repoRoot?: string
  argv?: string[]
  configPath?: string
  platform?: Platform
}

export interface FileSystemPort {
  exists(filePath: string): boolean
  readText(filePath: string | number): string
  readBytes(filePath: string): Uint8Array
  readDirectory(directory: string, options?: unknown): unknown[]
  stat(filePath: string): { size: number; isDirectory(): boolean }
  realPath(filePath: string): string
  remove(filePath: string, options?: unknown): void
}

export interface TextWriter {
  writeText(filePath: string, contents: string): string | void
}

export interface EnvironmentPort {
  cwd(): string
  args(): string[]
  variable(name: string): string | undefined
  exit(code: number): never
}

export interface ClockPort {
  nowIso(): string
  nowMilliseconds(): number
}

export interface HashPort {
  sha256(value: string): string
}

export interface RandomPort {
  uuid(): string
  token(bytes?: number): string
  timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean
}

export interface Platform {
  readonly fileSystem: FileSystemPort
  readonly environment: EnvironmentPort
  readonly clock: ClockPort
  readonly hash: HashPort
  readonly random: RandomPort
}

export function createNodePlatform(options?: {
  processRef?: {
    cwd(): string
    argv: string[]
    env: Record<string, string | undefined>
    exit(code: number): never
  }
}): Platform
export const nodePlatform: Platform

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

export function validateGraphDocument(document: unknown): CodeMapGraph

export interface ScanPhase {
  readonly id: string
  readonly requires: readonly string[]
  readonly provides: readonly string[]
  run(input: Readonly<Record<string, unknown>>): Record<string, unknown> | void
}

export interface ScanPipeline {
  readonly phases: readonly ScanPhase[]
  run(initialState?: Record<string, unknown>): Readonly<Record<string, unknown>>
}

export function defineScanPhase(phase: {
  id: string
  requires?: string[]
  provides?: string[]
  run(input: Readonly<Record<string, unknown>>): Record<string, unknown> | void
}): ScanPhase
export function createScanPipeline(phases: Array<ScanPhase | Parameters<typeof defineScanPhase>[0]>): ScanPipeline
export function createDefaultScanPipeline(): ScanPipeline
export function writeGraph(
  outputPath?: string,
  projectContext?: ProjectContext,
  options?: { pipeline?: ScanPipeline; writer?: TextWriter }
): CodeMapGraph
