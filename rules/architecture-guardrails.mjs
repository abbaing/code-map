import {
  csharpDescendants,
  csharpInvocationName,
  csharpSimpleTypeName,
  parseCSharp,
  walkCSharp
} from '#parsers/csharp.mjs'
import {
  escapeRegExp,
  parseTypeScript,
  typeScriptCallName,
  typescript as ts,
  walkTypeScript
} from '#parsers/typescript.mjs'
import { findingBase, getRuleMetadata, importsOf, lineOfIndex, ruleOption, runFileRules } from '#rules/rule-runner.mjs'

const stateHooks = new Set(['useState', 'useEffect', 'useMemo', 'useCallback', 'useReducer', 'useRef'])
const routingHooks = new Set(['useNavigate', 'useParams', 'useSearchParams', 'useLocation'])

export const ARCHITECTURE_RULES = [
  {
    id: 'framework.react.component-folder-entry',
    legacyIds: ['frontend.component-folder-entry'],
    defaultEnabled: true,
    meta: {
      severity: 'warning',
      category: 'architecture',
      confidence: 'high',
      effort: 'medium',
      message: 'Component files must be folder-based entry points.',
      why: 'Folder-based component entries keep tests, private parts, hooks, and local helpers colocated consistently.',
      fixHint: 'Move the component to a component folder entry file and update imports to the configured alias.',
      docsPath: 'docs/frontend-rules.md'
    },
    check({ nodeId, repoPath, type, projectMapRules, findingSink }) {
      if (!['component', 'main-component', 'subcomponent'].includes(type)) {
        return
      }
      if (!/\.[jt]sx$/u.test(repoPath)) {
        return
      }
      if (!isPathInRuleScope(repoPath, this, projectMapRules)) {
        return
      }
      const entryNames = ruleOption(projectMapRules, this, 'entryNames') ?? ['index.tsx', 'index.jsx']
      if (entryNames.some((entryName) => repoPath.endsWith(`/${entryName}`))) {
        return
      }
      findingSink.add({ ...findingBase(this), nodeId, path: repoPath, line: 1, evidence: repoPath.split('/').pop() })
    }
  },
  {
    id: 'architecture.mvvm.thin-view-entry',
    legacyIds: ['frontend.main-no-orchestration'],
    defaultEnabled: true,
    meta: {
      severity: 'error',
      category: 'architecture',
      confidence: 'medium',
      effort: 'medium',
      message: 'View entry components must stay thin; orchestration belongs in a hook or controller.',
      why: 'Composition boundaries are easier to reason about when state, routing, side effects, and API access live outside the view entry.',
      fixHint:
        'Move orchestration into a view-model hook or controller and keep the entry component as a small bridge to the view.',
      docsPath: 'docs/frontend-rules.md'
    },
    check({ nodeId, repoPath, content, syntax, type, projectMapRules, findingSink }) {
      if (!matchesAny(type, ruleOption(projectMapRules, this, 'types') ?? ['main-component'])) {
        return
      }
      if (!isPathInRuleScope(repoPath, this, projectMapRules)) {
        return
      }
      if (!isAllowedEntryPath(repoPath, this, projectMapRules)) {
        return
      }
      for (const { index, label } of orchestrationSignals(content, repoPath, syntax)) {
        findingSink.add({
          ...findingBase(this),
          nodeId,
          path: repoPath,
          line: lineOfIndex(content, index),
          evidence: label
        })
      }
    }
  },
  {
    id: 'architecture.feature-sliced.no-cross-feature-internals',
    defaultEnabled: true,
    meta: {
      severity: 'warning',
      category: 'architecture',
      confidence: 'high',
      effort: 'medium',
      message: 'Features must not import another feature internal implementation.',
      why: 'Feature slices stay independent when cross-feature access goes through explicit public entrypoints, shared contracts, or configured integration edges.',
      fixHint:
        'Move the shared contract to a public feature entrypoint or shared/application layer, or declare an explicit allowed edge.',
      docsPath: 'docs/frontend-rules.md'
    },
    check({ nodeId, repoPath, content, syntax, projectMapRules, projectContext, findingSink }) {
      const sourceFeature = featureFromPath(repoPath, projectContext)
      if (!sourceFeature) {
        return
      }
      for (const { specifier, index } of importsOf(content, repoPath, syntax)) {
        const targetFeature = featureFromSpecifier(specifier, this, projectMapRules)
        if (!targetFeature || targetFeature === sourceFeature) {
          continue
        }
        if (isAllowedFeatureImport(specifier, sourceFeature, targetFeature, this, projectMapRules)) {
          continue
        }
        findingSink.add({
          ...findingBase(this),
          nodeId,
          path: repoPath,
          line: lineOfIndex(content, index),
          evidence: specifier
        })
      }
    }
  },
  {
    id: 'architecture.mvvm.viewmodel-hook-naming',
    defaultEnabled: true,
    meta: {
      severity: 'warning',
      category: 'architecture',
      confidence: 'medium',
      effort: 'low',
      message: 'View entry components should use a colocated view-model hook.',
      why: 'A predictable hook naming convention keeps orchestration discoverable and out of the view entry.',
      fixHint: 'Create or import the expected view-model hook and keep the component entry as a prop bridge.',
      docsPath: 'docs/frontend-rules.md'
    },
    check({ nodeId, repoPath, content, syntax, type, projectMapRules, findingSink }) {
      if (!matchesAny(type, ruleOption(projectMapRules, this, 'types') ?? ['main-component'])) {
        return
      }
      if (!isAllowedEntryPath(repoPath, this, projectMapRules)) {
        return
      }
      const componentName = repoPath.split('/').at(-2)
      const componentSuffix = ruleOption(projectMapRules, this, 'componentSuffix') ?? 'Main'
      if (!componentName || (componentSuffix && !componentName.endsWith(componentSuffix))) {
        return
      }
      const hookPrefix = ruleOption(projectMapRules, this, 'hookPrefix') ?? 'use'
      const hookSuffix = ruleOption(projectMapRules, this, 'hookSuffix') ?? ''
      const expectedHook = `${hookPrefix}${componentName}${hookSuffix}`
      const sourceFile = syntax ?? parseTypeScript(content, repoPath)
      let callsExpectedHook = false
      walkTypeScript(sourceFile, (node) => {
        if (ts.isCallExpression(node) && typeScriptCallName(node.expression) === expectedHook) {
          callsExpectedHook = true
        }
      })
      if (callsExpectedHook) {
        return
      }
      findingSink.add({ ...findingBase(this), nodeId, path: repoPath, line: 1, evidence: expectedHook })
    }
  },
  {
    id: 'architecture.layered.no-ui-imports-in-data-adapters',
    defaultEnabled: true,
    meta: {
      severity: 'error',
      category: 'architecture',
      confidence: 'high',
      effort: 'medium',
      message: 'Data adapters must not import UI modules.',
      why: 'Data adapters should remain independent from presentation so API contracts do not depend on UI implementation details.',
      fixHint:
        'Move UI-facing types to shared contracts, feature types, or schema modules and keep adapters limited to API/data concerns.',
      docsPath: 'docs/frontend-rules.md'
    },
    check({ nodeId, repoPath, content, syntax, type, projectMapRules, findingSink }) {
      const adapterTypes = ruleOption(projectMapRules, this, 'types') ?? ['repository']
      if (!adapterTypes.includes(type)) {
        return
      }
      for (const { specifier, index } of importsOf(content, repoPath, syntax)) {
        if (!isUiImport(specifier, this, projectMapRules)) {
          continue
        }
        findingSink.add({
          ...findingBase(this),
          nodeId,
          path: repoPath,
          line: lineOfIndex(content, index),
          evidence: specifier
        })
      }
    }
  },
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
        findingSink.add({
          ...findingBase(this),
          nodeId,
          path: repoPath,
          line,
          evidence
        })
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
        if (!using) {
          continue
        }
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
]

export function runArchitectureGuardrails(
  files,
  defaultRules,
  projectContext,
  findingSink,
  sourceReader,
  sourceDocuments
) {
  runFileRules(
    files,
    ARCHITECTURE_RULES,
    defaultRules,
    projectContext.projectMap.rules,
    projectContext,
    findingSink,
    undefined,
    sourceReader,
    sourceDocuments
  )
}

export function getArchitectureGuardrailMetadata() {
  return getRuleMetadata(ARCHITECTURE_RULES)
}

function orchestrationSignals(content, fileName, syntax) {
  const sourceFile = syntax ?? parseTypeScript(content, fileName)
  const matches = new Map()
  const record = (label, node) => {
    if (!matches.has(label)) {
      matches.set(label, node.getStart(sourceFile))
    }
  }
  walkTypeScript(sourceFile, (node) => {
    if (ts.isCallExpression(node)) {
      const name = typeScriptCallName(node.expression)
      if (stateHooks.has(name)) {
        record('React orchestration hook', node)
      }
      if (routingHooks.has(name)) {
        record('routing hook', node)
      }
      if (['fetch', 'request', 'get', 'post', 'put', 'patch', 'delete'].includes(name)) {
        record('API/service/repository access', node)
      }
    }
    if (ts.isIdentifier(node) && node.text === 'apiClient') {
      record('API/service/repository access', node)
    }
    if (
      ts.isIdentifier(node) &&
      ['window', 'document', 'location', 'localStorage', 'sessionStorage'].includes(node.text)
    ) {
      record('browser side effect', node)
    }
  })
  return [...matches].map(([label, index]) => ({ label, index }))
}

function featureFromPath(repoPath, projectContext) {
  const pattern = projectContext.projectMap.modules?.frontendFeaturePattern
  if (!pattern) {
    return null
  }
  return repoPath.match(new RegExp(pattern))?.[1] ?? null
}

function featureFromSpecifier(specifier, rule, projectMapRules) {
  for (const pattern of ruleOption(projectMapRules, rule, 'specifierPatterns') ?? [
    '^@/features/([^/]+)',
    '^@features/([^/]+)'
  ]) {
    const match = specifier.match(new RegExp(pattern))
    if (match?.[1]) {
      return match[1]
    }
  }
  return null
}

function isAllowedFeatureImport(specifier, sourceFeature, targetFeature, rule, projectMapRules) {
  return (
    isPublicFeatureImport(specifier, targetFeature, rule, projectMapRules) ||
    isSharedFeatureImport(specifier, rule, projectMapRules) ||
    isConfiguredFeatureEdgeAllowed(specifier, sourceFeature, targetFeature, rule, projectMapRules)
  )
}

function isPublicFeatureImport(specifier, targetFeature, rule, projectMapRules) {
  const publicSegments = ruleOption(projectMapRules, rule, 'publicSegments') ?? ['', 'public']
  return publicSegments.some((segment) => {
    const suffix = segment ? `/${segment}` : ''
    return specifier === `@/features/${targetFeature}${suffix}` || specifier === `@features/${targetFeature}${suffix}`
  })
}

function isSharedFeatureImport(specifier, rule, projectMapRules) {
  const sharedSegments = ruleOption(projectMapRules, rule, 'sharedSegments') ?? [
    'types',
    'schemas',
    'constants',
    'config'
  ]
  return sharedSegments.some(
    (segment) =>
      new RegExp(`^@/features/[^/]+/${escapeRegExp(segment)}(?:/|$)`).test(specifier) ||
      new RegExp(`^@features/[^/]+/${escapeRegExp(segment)}(?:/|$)`).test(specifier)
  )
}

function isConfiguredFeatureEdgeAllowed(specifier, sourceFeature, targetFeature, rule, projectMapRules) {
  const allowedEdges = ruleOption(projectMapRules, rule, 'allowedEdges')
  if (!Array.isArray(allowedEdges)) {
    return false
  }
  return allowedEdges.some((edge) => {
    if (edge.from !== sourceFeature || edge.to !== targetFeature) {
      return false
    }
    const patterns = edge.specifierPatterns
    if (!Array.isArray(patterns) || patterns.length === 0) {
      return true
    }
    return matchesAny(specifier, patterns)
  })
}

function isUiImport(specifier, rule, projectMapRules) {
  const patterns = ruleOption(projectMapRules, rule, 'uiImportPatterns') ?? [
    '/components(?:/|$)',
    '/pages(?:/|$)',
    '/routes(?:/|$)',
    '^react$',
    '^react-router-dom$'
  ]
  return matchesAny(specifier, patterns)
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
  if (repoPath.includes(`/${namespacePrefix}.Application/`)) {
    return [`${namespacePrefix}.API`]
  }
  if (repoPath.includes(`/${namespacePrefix}.Infrastructure/`)) {
    return [`${namespacePrefix}.API`]
  }
  return []
}

function isAllowedEntryPath(repoPath, rule, projectMapRules) {
  const entryNames = ruleOption(projectMapRules, rule, 'entryNames') ?? ['index.tsx', 'index.jsx']
  return entryNames.some((entryName) => repoPath.endsWith(`/${entryName}`))
}

function isPathInRuleScope(repoPath, rule, projectMapRules) {
  const includePatterns = ruleOption(projectMapRules, rule, 'includePatterns')
  const excludePatterns = ruleOption(projectMapRules, rule, 'excludePatterns')
  if (Array.isArray(includePatterns) && includePatterns.length > 0 && !matchesAny(repoPath, includePatterns)) {
    return false
  }
  return !(Array.isArray(excludePatterns) && matchesAny(repoPath, excludePatterns))
}

function pathMatches(value, pattern) {
  return pattern ? new RegExp(pattern).test(value) : false
}

function matchesAny(value, patterns) {
  return patterns.some((pattern) => new RegExp(pattern).test(value))
}
