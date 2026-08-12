import type { Submap } from './submap-types.d.ts'

export interface SubmapRepository {
  read(filePath: string): Submap
  list(directory: string): string[]
  write(filePath: string, submap: Submap, options?: { force?: boolean }): string
}

export const nodeSubmapRepository: Readonly<SubmapRepository>
export const submapRepositoryContract: readonly ['read', 'list', 'write']
export function assertSubmapRepository(repository: unknown): SubmapRepository
