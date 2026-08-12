import { createEndpointExtractor } from '#core/endpoints.mjs'
import { collectUrlBindings, primaryBaseUrl } from '#parsers/typescript-endpoint-urls.mjs'
import {
  extractFetchCalls,
  extractFreeFunctionCalls,
  extractInstanceMethodCalls,
  extractObjectArguments,
  extractPositionalMethods,
  extractRequestObjects
} from '#parsers/typescript-endpoint-strategies.mjs'
import { parseTypeScript, typescript as ts, walkTypeScript } from '#parsers/typescript.mjs'

export { expandFrontendUrl } from '#parsers/typescript-endpoint-urls.mjs'

const endpointExtractor = createEndpointExtractor([
  { id: 'instance-methods', extract: extractInstanceMethodCalls },
  { id: 'free-functions', extract: extractFreeFunctionCalls },
  { id: 'request-objects', extract: extractRequestObjects },
  { id: 'object-arguments', extract: extractObjectArguments },
  { id: 'positional-methods', extract: extractPositionalMethods },
  { id: 'fetch', extract: extractFetchCalls }
])

export function extractFrontendEndpoints(
  content,
  importedBindings = new Map(),
  fileName = 'source.ts',
  parsedSourceFile
) {
  const sourceFile = parsedSourceFile ?? parseTypeScript(content, fileName)
  const urlBindings = new Map(importedBindings)
  for (const [name, value] of collectUrlBindings(sourceFile)) {
    urlBindings.set(name, value)
  }
  return endpointExtractor.extract({
    sourceFile,
    calls: callExpressions(sourceFile),
    urlBindings,
    baseUrl: primaryBaseUrl(urlBindings)
  })
}

function callExpressions(sourceFile) {
  const calls = []
  walkTypeScript(sourceFile, (node) => {
    if (ts.isCallExpression(node)) {
      calls.push(node)
    }
  })
  return calls
}
