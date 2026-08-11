import path from 'node:path'
import { createBackendAnalysisSession } from '#core/backend-analysis-session.mjs'
import { featureFromRepoPath } from '#core/classify.mjs'

export function createBackScanSession(allBackFiles, sourceDocuments) {
  const entries = allBackFiles.map((file) => {
    const document = sourceDocuments.requireDocumentOf(file)
    return { file, fileName: path.basename(file), declarations: document.syntax.declarations }
  })
  return createBackendAnalysisSession(entries)
}

export function findBackFileByName(session, fileName, preferModule, projectContext) {
  const bucket = session.filesNamed(fileName)
  if (bucket.length === 0) {
    return undefined
  }
  if (preferModule) {
    const sameModule = bucket.find(
      (file) => featureFromRepoPath(projectContext.toRepoPath(file), projectContext) === preferModule
    )
    if (sameModule) {
      return sameModule
    }
  }
  return bucket[0]
}
