import { featureFromRepoPath } from '#core/classify.mjs'

export function resolveEntityDeclaration(session, entityName, projectContext) {
  const candidates = session.declarationsNamed(entityName)
  const entityFragment = projectContext.projectMap.backend.entityPathFragment
  return (
    candidates.find(({ file }) => projectContext.toRepoPath(file).includes(entityFragment))?.file ?? candidates[0]?.file
  )
}

export function persistenceEntityModule(repoPath, projectContext) {
  const pattern = projectContext.projectMap.modules.backendEntityDomainPattern
  const match = repoPath.match(new RegExp(pattern))
  return match ? match[1].toLowerCase().replace(/[\s._]+/g, '-') : featureFromRepoPath(repoPath, projectContext)
}

export function entityModule(entity, entityNodeByName, projectContext) {
  const entityId = entityNodeByName.get(entity)
  const entityPath = entityId?.startsWith('file:') ? entityId.slice('file:'.length) : undefined
  return entityPath ? persistenceEntityModule(entityPath, projectContext) : projectContext.projectMap.modules.shared
}
