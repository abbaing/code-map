import path from 'node:path'
import { createBackendAnalysisSession } from '#core/backend-analysis-session.mjs'
import { featureFromRepoPath } from '#core/classify.mjs'
import { csharpTypeDeclarations } from '#scanners/scan-back-dependencies.mjs'
import { stripCSharpComments, stripCSharpStringLiterals } from '#core/source-analysis.mjs'

export function createBackScanSession(allBackFiles, sourceReader) {
  const entries = allBackFiles.map((file) => {
    const content = stripCSharpComments(stripCSharpStringLiterals(sourceReader.readText(file)))
    return { file, fileName: path.basename(file), declarations: csharpTypeDeclarations(content) }
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
