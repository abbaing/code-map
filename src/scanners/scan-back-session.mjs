import path from 'node:path'
import { createBackendAnalysisSession } from '#core/backend-analysis-session.mjs'
import { featureFromRepoPath } from '#core/classify.mjs'

export function createBackFileSet(files, projectContext) {
  const all = files.of('backend-source')
  const internalFragments = [
    projectContext.projectMap.backend?.dtoPathFragment,
    projectContext.projectMap.backend?.validatorPathFragment,
    projectContext.projectMap.backend?.mappingPathFragment
  ].filter(Boolean)
  const visible = all.filter((file) => {
    const repoPath = projectContext.toRepoPath(file)
    return internalFragments.every((fragment) => !repoPath.includes(fragment))
  })
  const controllerFragment = projectContext.projectMap.backend?.controllerPathFragment ?? '/Controllers/'
  return Object.freeze({
    all,
    visible: Object.freeze(visible),
    controllers: Object.freeze(visible.filter((file) => projectContext.toRepoPath(file).includes(controllerFragment)))
  })
}

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
