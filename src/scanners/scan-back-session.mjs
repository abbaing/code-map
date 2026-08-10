import path from 'node:path'
import { createBackendAnalysisSession } from '#core/backend-analysis-session.mjs'
import { csharpTypeDeclarations } from '#core/csharp-analysis.mjs'
import { featureFromRepoPath } from '#core/classify.mjs'

export function createBackScanSession(allBackFiles, sourceReader) {
  const entries = allBackFiles.map((file) => {
    return { file, fileName: path.basename(file), declarations: csharpTypeDeclarations(sourceReader.readText(file)) }
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
