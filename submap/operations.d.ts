import type { CodeMapGraph } from './graph-types.d.ts'
import type { SubmapStrategies } from './strategy-types.d.ts'
import type { AccessLevel, Submap, SubmapRequest, ValidationResult } from './submap-types.d.ts'

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
export const defaultSelectionStrategy: SubmapStrategies['selection']
export const defaultTraversalStrategy: SubmapStrategies['traversal']
export const defaultAccessStrategy: SubmapStrategies['access']
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
export class SubmapError extends Error {
  code: string
  details: Record<string, unknown>
  exitCode: number
}
