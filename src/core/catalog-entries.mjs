export function mergeCatalogEntriesById(left = [], right = []) {
  const entriesById = new Map(left.map((entry) => [entry.id, entry]))
  for (const entry of right) {
    entriesById.set(entry.id, { ...(entriesById.get(entry.id) ?? {}), ...entry })
  }
  return [...entriesById.values()]
}
