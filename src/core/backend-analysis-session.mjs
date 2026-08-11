import { createBackendDeclarationIndex } from '#core/backend-declaration-index.mjs'

export function createBackendAnalysisSession(entries = []) {
  if (!Array.isArray(entries)) {
    throw new TypeError('Backend analysis entries must be an array.')
  }
  return createBackendDeclarationIndex(entries)
}
