import path from 'node:path'
import { csharpName, walkCSharp } from '#parsers/csharp.mjs'

export function backendSemantics(document) {
  const { declarations, tree } = document.syntax
  const stem = path.basename(document.file, '.cs')
  let hasDbSet = false
  let implementsRequestHandler = false
  walkCSharp(tree.rootNode, (node) => {
    if (node.type !== 'generic_name') {
      return
    }
    const name = csharpName(node)
    hasDbSet ||= name === 'DbSet'
    implementsRequestHandler ||= name === 'IRequestHandler'
  })
  return {
    isDbContext: declarations.some((declaration) => declaration.baseTypes.includes('DbContext')) || hasDbSet,
    isRequestHandler: implementsRequestHandler || /(?:Command|Query)Handler$/u.test(stem),
    isMarkerInterface:
      /^I[A-Z]/u.test(stem) &&
      declarations.some((declaration) => declaration.kind === 'interface' && declaration.name === stem)
  }
}
