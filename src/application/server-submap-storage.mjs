import path from 'node:path'
import { ApplicationNotFoundError } from '#app/server-contracts.mjs'
import { validateSubmapUid } from '#app/server-input.mjs'

export function listStoredSubmaps(context) {
  const { state, paths, services, root } = context
  const directory = submapsDirectory(state.context, paths, root)
  return services.submaps
    .list(directory)
    .map((filePath) => storedSubmapSummary(filePath, services.submaps))
    .sort(compareSummaries)
}

export function getStoredSubmap(uid, { state, paths, services, root }) {
  validateSubmapUid(uid)
  const directory = submapsDirectory(state.context, paths, root)
  for (const filePath of services.submaps.list(directory)) {
    try {
      const submap = readValidSubmap(filePath, services.submaps)
      if (submap.uid === uid) {
        return submap
      }
    } catch (error) {
      if (recoverableStoredError(error)) {
        continue
      }
      throw error
    }
  }
  throw new ApplicationNotFoundError('Submap not found.')
}

export function submapsDirectory(context, paths, root) {
  return paths.projectPath(
    path.resolve(root, context.projectMap.project.submapsDirectory ?? '.code-map/submaps'),
    'project.submapsDirectory'
  )
}

function storedSubmapSummary(filePath, submaps) {
  try {
    return validSummary(readValidSubmap(filePath, submaps), filePath)
  } catch (error) {
    if (!recoverableStoredError(error)) {
      throw error
    }
    return invalidSummary(filePath, error)
  }
}

function readValidSubmap(filePath, submaps) {
  const submap = submaps.read(filePath)
  const validation = submaps.validate(submap)
  if (!validation.valid) {
    const issue = validation.errors[0]
    throw new StoredSubmapError(issue?.code, issue?.message)
  }
  return submap
}

function validSummary(submap, filePath) {
  return {
    id: submap.id,
    name: submap.metadata?.name ?? submap.id,
    uid: submap.uid,
    revision: submap.revision,
    parentUid: submap.parentUid,
    createdAt: submap.createdAt,
    projectName: submap.source?.projectName,
    statistics: submap.statistics,
    kind: submap.metadata?.kind ?? 'selection',
    file: path.basename(filePath),
    status: 'valid'
  }
}

function invalidSummary(filePath, error) {
  const file = path.basename(filePath)
  return {
    id: `invalid:${file}`,
    name: file,
    file,
    status: 'invalid',
    issue: storedIssue(error)
  }
}

function storedIssue(error) {
  const messages = {
    SUBMAP_INVALID_JSON: 'File does not contain valid JSON.',
    SUBMAP_FILE_NOT_FOUND: 'File is no longer available.'
  }
  return {
    code: error?.code ?? 'SUBMAP_INVALID',
    message: messages[error?.code] ?? error?.message ?? 'Unable to read this Submap file.'
  }
}

function compareSummaries(left, right) {
  return left.name.localeCompare(right.name) || (right.revision ?? 0) - (left.revision ?? 0)
}

function recoverableStoredError(error) {
  return error instanceof StoredSubmapError || String(error?.code).startsWith('SUBMAP_')
}

class StoredSubmapError extends Error {
  constructor(code, message) {
    super(message ?? 'Stored Submap validation failed.')
    this.code = code ?? 'SUBMAP_INVALID'
  }
}
