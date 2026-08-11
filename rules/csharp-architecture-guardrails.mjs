import {
  csharpDescendants,
  csharpInvocationName,
  csharpSimpleTypeName,
  parseCSharp,
  walkCSharp
} from '#parsers/csharp.mjs'
import { findingBase, getRuleMetadata, ruleOption, runFileRules } from '#rules/rule-runner.mjs'

export const CSHARP_ARCHITECTURE_RULES = Object.freeze([
  {
    id: 'architecture.mvc.thin-controller',
    defaultEnabled: true,
    meta: {
      severity: 'warning',
      category: 'architecture',
      confidence: 'medium',
      effort: 'medium',
      message: 'Controllers should stay thin and delegate behavior to application services or handlers.',
      why: 'Controllers are request entry points. Business flow belongs in commands, queries, handlers, or application services.',
      fixHint:
        'Move branching, persistence, and business logic into application handlers and keep controller actions as request/response adapters.',
      docsPath: 'docs/backend-rules.md'
    },
    check({ nodeId, repoPath, content, syntax, findingSink }) {
      if (!repoPath.includes('/Controllers/') || !repoPath.endsWith('Controller.cs')) {
        return
      }
      const tree = syntax?.tree ?? parseCSharp(content)
      const matches = new Map()
      walkCSharp(tree.rootNode, (node) => {
        if (
          (node.type === 'identifier' && ['_dbContext', 'DbContext'].includes(node.text)) ||
          (node.type === 'generic_name' && csharpSimpleTypeName(node) === 'Set')
        ) {
          matches.set('direct persistence access', node.startPosition.row + 1)
        }
        if (node.type === 'invocation_expression' && csharpInvocationName(node) === 'SaveChangesAsync') {
          matches.set('direct save changes', node.startPosition.row + 1)
        }
        if (['for_statement', 'for_each_statement', 'while_statement'].includes(node.type)) {
          matches.set('loop in controller action', node.startPosition.row + 1)
        }
        if (node.type === 'if_statement' && csharpDescendants(node, 'await_expression').length >= 2) {
          matches.set('branch with multiple awaits', node.startPosition.row + 1)
        }
      })
      for (const [evidence, line] of matches) {
        findingSink.add({ ...findingBase(this), nodeId, path: repoPath, line, evidence })
      }
    }
  },
  {
    id: 'architecture.clean-architecture.layer-boundaries',
    defaultEnabled: true,
    meta: {
      severity: 'error',
      category: 'architecture',
      confidence: 'high',
      effort: 'medium',
      message: 'Backend layers must not depend in the wrong direction.',
      why: 'Clean architecture depends inward. Domain stays pure and outer layers depend on inner boundaries, not the reverse.',
      fixHint: 'Move shared contracts inward or invert the dependency through application/domain abstractions.',
      docsPath: 'docs/backend-rules.md'
    },
    check({ nodeId, repoPath, content, syntax, projectMapRules, findingSink }) {
      const forbidden = forbiddenBackendUsings(repoPath, this, projectMapRules)
      if (forbidden.length === 0) {
        return
      }
      const tree = syntax?.tree ?? parseCSharp(content)
      const usings = csharpDescendants(tree.rootNode, 'using_directive')
      for (const item of forbidden) {
        const using = usings.find((node) => {
          const namespace = node.namedChildren.at(-1)?.text ?? ''
          return namespace === item || namespace.startsWith(`${item}.`)
        })
        if (using) {
          findingSink.add({
            ...findingBase(this),
            nodeId,
            path: repoPath,
            line: using.startPosition.row + 1,
            evidence: `using ${item}`
          })
        }
      }
    }
  }
])

export function runCSharpArchitectureGuardrails(
  files,
  defaultRules,
  projectContext,
  findingSink,
  sourceReader,
  sourceDocuments
) {
  runFileRules(
    files,
    CSHARP_ARCHITECTURE_RULES,
    defaultRules,
    projectContext.projectMap.rules,
    projectContext,
    findingSink,
    undefined,
    sourceReader,
    sourceDocuments
  )
}

export function getCSharpArchitectureGuardrailMetadata() {
  return getRuleMetadata(CSHARP_ARCHITECTURE_RULES)
}

function forbiddenBackendUsings(repoPath, rule, projectMapRules) {
  const namespacePrefix = ruleOption(projectMapRules, rule, 'namespacePrefix')
  const layerRules = ruleOption(projectMapRules, rule, 'layers')
  if (Array.isArray(layerRules)) {
    return layerRules
      .filter((layer) => pathMatches(repoPath, layer.pathPattern))
      .flatMap((layer) => layer.forbiddenUsings ?? [])
  }
  if (!namespacePrefix) {
    return []
  }
  if (repoPath.includes(`/${namespacePrefix}.Domain/`)) {
    return [`${namespacePrefix}.API`, `${namespacePrefix}.Application`, `${namespacePrefix}.Infrastructure`]
  }
  if (
    repoPath.includes(`/${namespacePrefix}.Application/`) ||
    repoPath.includes(`/${namespacePrefix}.Infrastructure/`)
  ) {
    return [`${namespacePrefix}.API`]
  }
  return []
}

function pathMatches(value, pattern) {
  return pattern ? new RegExp(pattern).test(value) : false
}
