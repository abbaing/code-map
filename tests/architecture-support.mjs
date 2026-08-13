import fs from 'node:fs'
import path from 'node:path'

export function listSourceFiles(directory) {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['.git', 'architecture', 'node_modules', 'tests'].includes(entry.name)) {
      continue
    }
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(target))
    } else if (/\.(?:mjs|js)$/u.test(entry.name) && entry.name !== 'eslint.config.js') {
      files.push(target)
    }
  }
  return files.sort()
}

export function localDependencies(file, root) {
  return importSpecifiers(fs.readFileSync(file, 'utf8'))
    .map((specifier) => resolveLocalSpecifier(specifier, root))
    .filter(Boolean)
    .filter((target) => fs.existsSync(target))
}

export function importSpecifiers(source) {
  return [...source.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g)].map((match) => match[2])
}

export function relativePath(file, root) {
  return path.relative(root, file).replaceAll(path.sep, '/')
}

function resolveLocalSpecifier(specifier, root) {
  const aliases = new Map([
    ['#app/', 'src/application/'],
    ['#architecture/', 'architecture/'],
    ['#core/', 'src/core/'],
    ['#delivery/', 'src/delivery/'],
    ['#entry/', ''],
    ['#node/', 'src/adapters/node/'],
    ['#parsers/', 'src/adapters/parsers/'],
    ['#platform/', 'platform/'],
    ['#rules/', 'rules/'],
    ['#scanners/', 'src/scanners/'],
    ['#submap/', 'submap/'],
    ['#templates/', 'templates/'],
    ['#viewer/', 'viewer/']
  ])
  for (const [prefix, directory] of aliases) {
    if (specifier.startsWith(prefix)) {
      return path.join(root, directory, specifier.slice(prefix.length))
    }
  }
  return null
}

export function findCycles(graph, root) {
  const cycles = []
  const visited = new Set()
  const active = []
  const activeSet = new Set()
  const relative = (file) => path.relative(root, file).replaceAll(path.sep, '/')

  function visit(node) {
    if (activeSet.has(node)) {
      const start = active.indexOf(node)
      cycles.push([...active.slice(start), node].map(relative))
      return
    }
    if (visited.has(node)) {
      return
    }
    visited.add(node)
    active.push(node)
    activeSet.add(node)
    for (const target of graph.get(node) ?? []) {
      visit(target)
    }
    active.pop()
    activeSet.delete(node)
  }

  for (const node of graph.keys()) {
    visit(node)
  }
  return cycles
}
