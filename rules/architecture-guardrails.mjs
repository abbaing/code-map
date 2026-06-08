import { getProjectMap } from '../config.mjs'
import { addFinding } from './findings.mjs'
import { findingBase, getRuleMetadata, importsOf, lineOfIndex, ruleOption, runFileRules } from './rule-runner.mjs'

const reactStateHooks = /\buse(State|Effect|Memo|Callback|Reducer|Ref)\s*\(/g
const reactRoutingHooks = /\buse(Navigate|Params|SearchParams|Location)\s*\(/g
const apiOrRepositoryAccess = /\b(?:fetch|apiClient)\b|\.request\s*\(|\.(?:get|post|put|patch|delete)\s*</g
const browserSideEffects = /\b(?:window\.|document\.|location\.|localStorage|sessionStorage)\b/g

const ORCHESTRATION_SIGNALS = [
  { pattern: reactStateHooks, label: 'React orchestration hook' },
  { pattern: reactRoutingHooks, label: 'routing hook' },
  { pattern: apiOrRepositoryAccess, label: 'API/service/repository access' },
  { pattern: browserSideEffects, label: 'browser side effect' }
]

export const ARCHITECTURE_RULES = [
  {
    id: 'framework.react.component-folder-entry',
    legacyIds: ['frontend.component-folder-entry', 'repo.halley.component-folder-entry'],
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
    check({ nodeId, repoPath, type, projectMapRules }) {
      if (!['component', 'main-component', 'subcomponent'].includes(type)) return
      if (!/\.[jt]sx$/u.test(repoPath)) return
      if (!isPathInRuleScope(repoPath, this, projectMapRules)) return
      const entryNames = ruleOption(projectMapRules, this, 'entryNames') ?? ['index.tsx', 'index.jsx']
      if (entryNames.some(entryName => repoPath.endsWith(`/${entryName}`))) return
      addFinding({ ...findingBase(this), nodeId, path: repoPath, line: 1, evidence: repoPath.split('/').pop() })
    }
  },
  {
    id: 'architecture.mvvm.thin-view-entry',
    legacyIds: ['frontend.main-no-orchestration', 'repo.halley.main-no-orchestration'],
    defaultEnabled: true,
    meta: {
      severity: 'error',
      category: 'architecture',
      confidence: 'medium',
      effort: 'medium',
      message: 'View entry components must stay thin; orchestration belongs in a hook or controller.',
      why: 'Composition boundaries are easier to reason about when state, routing, side effects, and API access live outside the view entry.',
      fixHint: 'Move orchestration into a view-model hook or controller and keep the entry component as a small bridge to the view.',
      docsPath: 'docs/frontend-rules.md'
    },
    check({ nodeId, repoPath, content, type, projectMapRules }) {
      if (!matchesAny(type, ruleOption(projectMapRules, this, 'types') ?? ['main-component'])) return
      if (!isPathInRuleScope(repoPath, this, projectMapRules)) return
      if (!isAllowedEntryPath(repoPath, this, projectMapRules)) return
      for (const { pattern, label } of ORCHESTRATION_SIGNALS) {
        const match = pattern.exec(content)
        pattern.lastIndex = 0
        if (!match) continue
        addFinding({ ...findingBase(this), nodeId, path: repoPath, line: lineOfIndex(content, match.index), evidence: label })
      }
    }
  },
  {
    id: 'architecture.feature-sliced.no-cross-feature-internals',
    legacyIds: ['repo.halley.feature-boundaries'],
    defaultEnabled: true,
    meta: {
      severity: 'warning',
      category: 'architecture',
      confidence: 'high',
      effort: 'medium',
      message: 'Features must not import another feature internal implementation.',
      why: 'Feature slices stay independent when cross-feature access goes through explicit public entrypoints, shared contracts, or configured integration edges.',
      fixHint: 'Move the shared contract to a public feature entrypoint or shared/application layer, or declare an explicit allowed edge.',
      docsPath: 'docs/frontend-rules.md'
    },
    check({ nodeId, repoPath, content, projectMapRules }) {
      const sourceFeature = featureFromPath(repoPath)
      if (!sourceFeature) return
      for (const { specifier, index } of importsOf(content)) {
        const targetFeature = featureFromSpecifier(specifier, this, projectMapRules)
        if (!targetFeature || targetFeature === sourceFeature) continue
        if (isAllowedFeatureImport(specifier, sourceFeature, targetFeature, this, projectMapRules)) continue
        addFinding({ ...findingBase(this), nodeId, path: repoPath, line: lineOfIndex(content, index), evidence: specifier })
      }
    }
  },
  {
    id: 'architecture.mvvm.viewmodel-hook-naming',
    legacyIds: ['repo.halley.hook-viewmodel-naming'],
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
    check({ nodeId, repoPath, content, type, projectMapRules }) {
      if (!matchesAny(type, ruleOption(projectMapRules, this, 'types') ?? ['main-component'])) return
      if (!isAllowedEntryPath(repoPath, this, projectMapRules)) return
      const componentName = repoPath.split('/').at(-2)
      const componentSuffix = ruleOption(projectMapRules, this, 'componentSuffix') ?? 'Main'
      if (!componentName || (componentSuffix && !componentName.endsWith(componentSuffix))) return
      const hookPrefix = ruleOption(projectMapRules, this, 'hookPrefix') ?? 'use'
      const hookSuffix = ruleOption(projectMapRules, this, 'hookSuffix') ?? ''
      const expectedHook = `${hookPrefix}${componentName}${hookSuffix}`
      if (new RegExp(`\\b${escapeRegExp(expectedHook)}\\s*\\(`).test(content)) return
      addFinding({ ...findingBase(this), nodeId, path: repoPath, line: 1, evidence: expectedHook })
    }
  },
  {
    id: 'architecture.layered.no-ui-imports-in-data-adapters',
    legacyIds: ['repo.halley.service-repository-no-ui-imports'],
    defaultEnabled: true,
    meta: {
      severity: 'error',
      category: 'architecture',
      confidence: 'high',
      effort: 'medium',
      message: 'Data adapters must not import UI modules.',
      why: 'Data adapters should remain independent from presentation so API contracts do not depend on UI implementation details.',
      fixHint: 'Move UI-facing types to shared contracts, feature types, or schema modules and keep adapters limited to API/data concerns.',
      docsPath: 'docs/frontend-rules.md'
    },
    check({ nodeId, repoPath, content, type, projectMapRules }) {
      const adapterTypes = ruleOption(projectMapRules, this, 'types') ?? ['repository']
      if (!adapterTypes.includes(type)) return
      for (const { specifier, index } of importsOf(content)) {
        if (!isUiImport(specifier, this, projectMapRules)) continue
        addFinding({ ...findingBase(this), nodeId, path: repoPath, line: lineOfIndex(content, index), evidence: specifier })
      }
    }
  },
  {
    id: 'architecture.mvc.thin-controller',
    legacyIds: ['repo.halley.controller-thin'],
    defaultEnabled: true,
    meta: {
      severity: 'warning',
      category: 'architecture',
      confidence: 'medium',
      effort: 'medium',
      message: 'Controllers should stay thin and delegate behavior to application services or handlers.',
      why: 'Controllers are request entry points. Business flow belongs in commands, queries, handlers, or application services.',
      fixHint: 'Move branching, persistence, and business logic into application handlers and keep controller actions as request/response adapters.',
      docsPath: 'docs/backend-rules.md'
    },
    check({ nodeId, repoPath, content }) {
      if (!repoPath.includes('/Controllers/') || !repoPath.endsWith('Controller.cs')) return
      const checks = [
        { pattern: /\b_dbContext\b|\bDbContext\b|\bSet\s*</, label: 'direct persistence access' },
        { pattern: /\bSaveChangesAsync\s*\(/, label: 'direct save changes' },
        { pattern: /\bforeach\s*\(|\bwhile\s*\(|\bfor\s*\(/, label: 'loop in controller action' },
        { pattern: /\bif\s*\([\s\S]{0,120}\)\s*\{[\s\S]{0,220}\bawait\b[\s\S]{0,220}\bawait\b/, label: 'branch with multiple awaits' }
      ]
      for (const check of checks) {
        const match = content.match(check.pattern)
        if (!match) continue
        addFinding({ ...findingBase(this), nodeId, path: repoPath, line: lineOfIndex(content, match.index), evidence: check.label })
      }
    }
  },
  {
    id: 'architecture.clean-architecture.layer-boundaries',
    legacyIds: ['repo.halley.backend-layer-boundaries'],
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
    check({ nodeId, repoPath, content, projectMapRules }) {
      const forbidden = forbiddenBackendUsings(repoPath, this, projectMapRules)
      if (forbidden.length === 0) return
      for (const item of forbidden) {
        const pattern = new RegExp(`^\\s*using\\s+${escapeRegExp(item)}(?:\\.|;)`, 'm')
        const match = content.match(pattern)
        if (!match) continue
        addFinding({ ...findingBase(this), nodeId, path: repoPath, line: lineOfIndex(content, match.index), evidence: `using ${item}` })
      }
    }
  }
]

export function runArchitectureGuardrails(files, defaultRules = {}) {
  runFileRules(files, ARCHITECTURE_RULES, defaultRules, getProjectMap().rules)
}

export function getArchitectureGuardrailMetadata() {
  return getRuleMetadata(ARCHITECTURE_RULES)
}

function featureFromPath(repoPath) {
  const pattern = getProjectMap().modules?.frontendFeaturePattern
  if (!pattern) return null
  return repoPath.match(new RegExp(pattern))?.[1] ?? null
}

function featureFromSpecifier(specifier, rule, projectMapRules) {
  for (const pattern of ruleOption(projectMapRules, rule, 'specifierPatterns') ?? ['^@/features/([^/]+)', '^@features/([^/]+)']) {
    const match = specifier.match(new RegExp(pattern))
    if (match?.[1]) return match[1]
  }
  return null
}

function isAllowedFeatureImport(specifier, sourceFeature, targetFeature, rule, projectMapRules) {
  return isPublicFeatureImport(specifier, targetFeature, rule, projectMapRules)
    || isSharedFeatureImport(specifier, rule, projectMapRules)
    || isConfiguredFeatureEdgeAllowed(specifier, sourceFeature, targetFeature, rule, projectMapRules)
}

function isPublicFeatureImport(specifier, targetFeature, rule, projectMapRules) {
  const publicSegments = ruleOption(projectMapRules, rule, 'publicSegments') ?? ['', 'public']
  return publicSegments.some(segment => {
    const suffix = segment ? `/${segment}` : ''
    return specifier === `@/features/${targetFeature}${suffix}`
      || specifier === `@features/${targetFeature}${suffix}`
  })
}

function isSharedFeatureImport(specifier, rule, projectMapRules) {
  const sharedSegments = ruleOption(projectMapRules, rule, 'sharedSegments') ?? ['types', 'schemas', 'constants', 'config']
  return sharedSegments.some(segment =>
    new RegExp(`^@/features/[^/]+/${escapeRegExp(segment)}(?:/|$)`).test(specifier)
    || new RegExp(`^@features/[^/]+/${escapeRegExp(segment)}(?:/|$)`).test(specifier)
  )
}

function isConfiguredFeatureEdgeAllowed(specifier, sourceFeature, targetFeature, rule, projectMapRules) {
  const allowedEdges = ruleOption(projectMapRules, rule, 'allowedEdges')
  if (!Array.isArray(allowedEdges)) return false
  return allowedEdges.some(edge => {
    if (edge.from !== sourceFeature || edge.to !== targetFeature) return false
    const patterns = edge.specifierPatterns
    if (!Array.isArray(patterns) || patterns.length === 0) return true
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
      .filter(layer => pathMatches(repoPath, layer.pathPattern))
      .flatMap(layer => layer.forbiddenUsings ?? [])
  }
  if (!namespacePrefix) return []
  if (repoPath.includes(`/${namespacePrefix}.Domain/`)) return [`${namespacePrefix}.API`, `${namespacePrefix}.Application`, `${namespacePrefix}.Infrastructure`]
  if (repoPath.includes(`/${namespacePrefix}.Application/`)) return [`${namespacePrefix}.API`]
  if (repoPath.includes(`/${namespacePrefix}.Infrastructure/`)) return [`${namespacePrefix}.API`]
  return []
}

function isAllowedEntryPath(repoPath, rule, projectMapRules) {
  const entryNames = ruleOption(projectMapRules, rule, 'entryNames') ?? ['index.tsx', 'index.jsx']
  return entryNames.some(entryName => repoPath.endsWith(`/${entryName}`))
}

function isPathInRuleScope(repoPath, rule, projectMapRules) {
  const includePatterns = ruleOption(projectMapRules, rule, 'includePatterns')
  const excludePatterns = ruleOption(projectMapRules, rule, 'excludePatterns')
  if (Array.isArray(includePatterns) && includePatterns.length > 0 && !matchesAny(repoPath, includePatterns)) return false
  return !(Array.isArray(excludePatterns) && matchesAny(repoPath, excludePatterns))
}

function pathMatches(value, pattern) {
  return pattern ? new RegExp(pattern).test(value) : false
}

function matchesAny(value, patterns) {
  return patterns.some(pattern => new RegExp(pattern).test(value))
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
