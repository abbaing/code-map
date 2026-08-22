export function latestSubmapRevisions(submaps) {
  return groupedRevisions(submaps).map((revisions) => ({
    ...revisions[0],
    revisionCount: revisions.length
  }))
}

export function revisionsForSubmap(submaps, id) {
  return submaps.filter((submap) => submap.id === id).sort(compareRevisions)
}

function groupedRevisions(submaps) {
  const groups = new Map()
  for (const submap of submaps) {
    const revisions = groups.get(submap.id) ?? []
    revisions.push(submap)
    groups.set(submap.id, revisions)
  }
  return [...groups.values()].map((revisions) => revisions.sort(compareRevisions))
}

function compareRevisions(left, right) {
  return right.revision - left.revision || String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? ''))
}
