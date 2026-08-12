import { csharpParser } from '#parsers/csharp.mjs'
import { backendSemantics } from '#parsers/csharp-backend-semantics.mjs'
import { constructorDependencies } from '#parsers/csharp-backend-dependencies.mjs'
import { collectDispatchedRequests, controllerAnalysis } from '#parsers/csharp-backend-requests.mjs'
import { dbSets, entityProperties, entityUsage, tableName } from '#parsers/csharp-backend-persistence.mjs'

export const csharpBackendFacts = Object.freeze({
  backendSemantics,
  constructorDependencies: ({ syntax }) => constructorDependencies(syntax),
  controller: ({ syntax }) => controllerAnalysis(syntax.tree),
  dispatchedRequests: ({ syntax }) => [...collectDispatchedRequests(syntax.tree.rootNode)],
  dbSets: ({ syntax }) => dbSets(syntax),
  tableName: ({ syntax }) => tableName(syntax.tree),
  entityProperties: ({ syntax }) => entityProperties(syntax.tree),
  entityUsage: ({ syntax }, input) => entityUsage(syntax.tree.rootNode, input.entity, input.dbSet)
})

export const csharpBackendParser = Object.freeze({
  ...csharpParser,
  facts: Object.freeze({ ...csharpParser.facts, ...csharpBackendFacts })
})
