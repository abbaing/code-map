import { csharpParser } from '#parsers/csharp.mjs'
import { backendSemantics } from '#parsers/csharp-backend-semantics.mjs'
import { constructorDependencies } from '#parsers/csharp-backend-dependencies.mjs'
import { collectDispatchedRequests, controllerAnalysis } from '#parsers/csharp-backend-requests.mjs'
import {
  dbSets,
  entityProperties,
  entityUsages,
  tableMapping,
  tableName
} from '#parsers/csharp-backend-persistence.mjs'

export const csharpBackendFacts = Object.freeze({
  backendSemantics,
  constructorDependencies: ({ syntax }) => constructorDependencies(syntax),
  controller: ({ syntax }) => controllerAnalysis(syntax.tree),
  dispatchedRequests: ({ syntax }) => [...collectDispatchedRequests(syntax.tree.rootNode)],
  dbSets: ({ syntax }) => dbSets(syntax),
  persistenceCollections: ({ syntax }) =>
    dbSets(syntax).map((fact) => ({ ...fact, evidence: `DbSet<${fact.entity}> ${fact.name}` })),
  tableName: ({ syntax }) => tableName(syntax.tree),
  tableMapping: ({ syntax }) => tableMapping(syntax.tree),
  entityProperties: ({ syntax }) => entityProperties(syntax.tree),
  entityUsages: ({ syntax }, input) => entityUsages(syntax.tree.rootNode, input.entities, input.dbSets)
})

export const csharpBackendParser = Object.freeze({
  ...csharpParser,
  facts: Object.freeze({ ...csharpParser.facts, ...csharpBackendFacts })
})
