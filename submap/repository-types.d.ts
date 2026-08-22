import type { Submap } from './submap-types.d.ts'

export interface SubmapRepository {
  read(filePath: string): Submap
  list(directory: string): string[]
  write(filePath: string, submap: Submap, options?: { force?: boolean }): string
}

export interface RemovableSubmapRepository {
  remove(filePath: string): string
}

export const nodeSubmapRepository: Readonly<SubmapRepository & RemovableSubmapRepository>
export const submapRepositoryContract: readonly ['read', 'list', 'write']
export function assertSubmapRepository(repository: unknown): SubmapRepository
