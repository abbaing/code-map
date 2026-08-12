import { escapeRegExp } from '#core/source-analysis.mjs'
import { parseTypeScript, typeScriptCallName, typescript as ts, walkTypeScript } from '#parsers/typescript.mjs'
import { ruleOption } from '#rules/rule-runner.mjs'

const stateHooks = new Set(['useState', 'useEffect', 'useMemo', 'useCallback', 'useReducer', 'useRef'])
const routingHooks = new Set(['useNavigate', 'useParams', 'useSearchParams', 'useLocation'])

export function orchestrationSignals(content, fileName, syntax) {
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

export function featureFromPath(repoPath, projectContext) {
  const pattern = projectContext.projectMap.modules?.frontendFeaturePattern
  if (!pattern) {
    return null
  }
  return repoPath.match(new RegExp(pattern))?.[1] ?? null
}

export function featureFromSpecifier(specifier, rule, projectMapRules) {
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

export function isAllowedFeatureImport(specifier, sourceFeature, targetFeature, rule, projectMapRules) {
  return (
    isPublicFeatureImport(specifier, targetFeature, rule, projectMapRules) ||
    isSharedFeatureImport(specifier, rule, projectMapRules) ||
    isConfiguredFeatureEdgeAllowed(specifier, sourceFeature, targetFeature, rule, projectMapRules)
  )
}

export function isPublicFeatureImport(specifier, targetFeature, rule, projectMapRules) {
  const publicSegments = ruleOption(projectMapRules, rule, 'publicSegments') ?? ['', 'public']
  return publicSegments.some((segment) => {
    const suffix = segment ? `/${segment}` : ''
    return specifier === `@/features/${targetFeature}${suffix}` || specifier === `@features/${targetFeature}${suffix}`
  })
}

export function isSharedFeatureImport(specifier, rule, projectMapRules) {
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

export function isConfiguredFeatureEdgeAllowed(specifier, sourceFeature, targetFeature, rule, projectMapRules) {
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

export function isUiImport(specifier, rule, projectMapRules) {
  const patterns = ruleOption(projectMapRules, rule, 'uiImportPatterns') ?? [
    '/components(?:/|$)',
    '/pages(?:/|$)',
    '/routes(?:/|$)',
    '^react$',
    '^react-router-dom$'
  ]
  return matchesAny(specifier, patterns)
}

export function isAllowedEntryPath(repoPath, rule, projectMapRules) {
  const entryNames = ruleOption(projectMapRules, rule, 'entryNames') ?? ['index.tsx', 'index.jsx']
  return entryNames.some((entryName) => repoPath.endsWith(`/${entryName}`))
}

export function isPathInRuleScope(repoPath, rule, projectMapRules) {
  const includePatterns = ruleOption(projectMapRules, rule, 'includePatterns')
  const excludePatterns = ruleOption(projectMapRules, rule, 'excludePatterns')
  if (Array.isArray(includePatterns) && includePatterns.length > 0 && !matchesAny(repoPath, includePatterns)) {
    return false
  }
  return !(Array.isArray(excludePatterns) && matchesAny(repoPath, excludePatterns))
}

export function matchesAny(value, patterns) {
  return patterns.some((pattern) => new RegExp(pattern).test(value))
}
