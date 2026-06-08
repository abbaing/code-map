import { getProjectMap } from '../config.mjs'
import { addFinding } from './findings.mjs'
import { findingBase, getRuleMetadata, importsOf, lineOfIndex, ruleOption, runFileRules } from './rule-runner.mjs'

// Rule interface: { id, defaultEnabled, meta, check(nodeId, repoPath, content, type, projectMap) }

export const RULES = [
  {
    id: 'technology.typescript.relative-imports',
    legacyIds: ['frontend.relative-imports'],
    defaultEnabled: true,
    meta: {
      severity: 'error',
      category: 'architecture',
      confidence: 'high',
      effort: 'low',
      message: 'Frontend imports must use configured aliases instead of relative paths.',
      why: 'Absolute imports keep module boundaries stable when files move and make dependency paths readable across projects.',
      fixHint: 'Replace the relative import with the configured alias, usually @/...',
      docsPath: 'docs/frontend-rules.md'
    },
    check({ nodeId, repoPath, content }) {
      for (const { specifier, index } of importsOf(content)) {
        if (!specifier.startsWith('.')) continue
        addFinding({ ...findingBase(this), nodeId, path: repoPath, line: lineOfIndex(content, index), evidence: specifier })
      }
    }
  },
  {
    id: 'framework.react.component-max-lines',
    legacyIds: ['frontend.component-max-lines'],
    defaultEnabled: true,
    meta: {
      severity: 'error',
      category: 'maintainability',
      confidence: 'high',
      effort: 'medium',
      message: 'Component files exceed the configured line limit.',
      why: 'Large component files usually mix orchestration, view model derivation, and rendering, which makes changes risky.',
      fixHint: 'Extract private subcomponents, typed config, helpers, or a dedicated hook until the component is below the limit.',
      docsPath: 'docs/frontend-rules.md'
    },
    check({ nodeId, repoPath, content, type, projectMapRules }) {
      if (!['component', 'main-component', 'subcomponent'].includes(type)) return
      if (!/\.[jt]sx$/u.test(repoPath)) return
      if (!isPathInRuleScope(repoPath, this, projectMapRules)) return
      const max = ruleOption(projectMapRules, this, 'max') ?? 200
      const lines = content.split(/\r?\n/).length
      if (lines <= max) return
      addFinding({ ...findingBase(this), nodeId, path: repoPath, line: max + 1, message: `Component files may not exceed ${max} lines.`, evidence: `${lines} lines` })
    }
  },
  {
    id: 'technology.typescript.no-any',
    legacyIds: ['frontend.no-any'],
    defaultEnabled: true,
    meta: {
      severity: 'error',
      category: 'type-safety',
      confidence: 'high',
      effort: 'medium',
      message: '`any` and `as any` are forbidden in frontend source.',
      why: '`any` removes compile-time guarantees at exactly the boundaries where UI contracts drift most easily.',
      fixHint: 'Replace with a concrete type, generic contract, discriminated union, or bounded unknown with explicit narrowing.',
      docsPath: 'docs/frontend-rules.md'
    },
    check({ nodeId, repoPath, content }) {
      const patterns = [
        { pattern: /\bas\s+any\b/g, label: 'as any' },
        { pattern: /:\s*any\b/g, label: ': any' },
        { pattern: /<\s*any\s*>/g, label: '<any>' },
        { pattern: /\bArray\s*<\s*any\s*>/g, label: 'Array<any>' }
      ]
      for (const { pattern, label } of patterns) {
        for (const match of content.matchAll(pattern)) {
          addFinding({ ...findingBase(this), nodeId, path: repoPath, line: lineOfIndex(content, match.index), evidence: label })
        }
      }
    }
  },
  {
    id: 'framework.react.route-file-shape',
    legacyIds: ['frontend.route-file-shape'],
    defaultEnabled: true,
    meta: {
      severity: 'error',
      category: 'routing',
      confidence: 'high',
      effort: 'medium',
      message: 'Feature route files must only declare typed RouteConfig entries and render FeatureRoutes.',
      why: 'Routes stay predictable when lazy loading, permission gates, and access-denied rendering are centralized outside feature route config.',
      fixHint: 'Statically import pages, use RouteConfig[] with { path, component }, and move permissions into PermissionedPage.',
      docsPath: 'docs/frontend-rules.md'
    },
    check({ nodeId, repoPath, content, type }) {
      if (type !== 'route') return
      if (!repoPath.endsWith('/routes/index.tsx') && !repoPath.endsWith('/routes/index.jsx')) return
      const checks = [
        { rule: /\blazy\s*\(/g, label: 'lazy()' },
        { rule: /\bSuspense\b/g, label: 'Suspense' },
        { rule: /\bRequirePermission\b/g, label: 'RequirePermission' },
        { rule: /\bAccessDenied\b/g, label: 'AccessDenied' },
        { rule: /\bReact\.ComponentType\b/g, label: 'React.ComponentType' },
        { rule: /\bpermission\s*:/g, label: 'permission in route config' }
      ]
      for (const check of checks) {
        const match = check.rule.exec(content)
        check.rule.lastIndex = 0
        if (!match) continue
        addFinding({ ...findingBase(this), nodeId, path: repoPath, line: lineOfIndex(content, match.index), evidence: check.label })
      }
    }
  }
]

export function runFrontendGuardrails(files, defaultRules = {}) {
  runFileRules(files, RULES, defaultRules, getProjectMap().rules)
}

export function getFrontendGuardrailMetadata() {
  return getRuleMetadata(RULES)
}

function isPathInRuleScope(repoPath, rule, projectMapRules) {
  const includePatterns = ruleOption(projectMapRules, rule, 'includePatterns')
  const excludePatterns = ruleOption(projectMapRules, rule, 'excludePatterns')

  if (Array.isArray(includePatterns) && includePatterns.length > 0 && !matchesAny(repoPath, includePatterns)) {
    return false
  }

  return !(Array.isArray(excludePatterns) && matchesAny(repoPath, excludePatterns))
}

function matchesAny(value, patterns) {
  return patterns.some(pattern => new RegExp(pattern).test(value))
}
