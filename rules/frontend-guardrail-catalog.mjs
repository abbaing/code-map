import {
  importsOf,
  parseTypeScript,
  typeScriptCallName,
  typescript as ts,
  walkTypeScript
} from '#parsers/typescript.mjs'
import { isPathInRuleScope } from '#rules/typescript-architecture-policy.mjs'
import { findingBase, lineOfIndex, ruleOption } from '#rules/rule-runner.mjs'

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
    check({ nodeId, repoPath, content, syntax, findingSink }) {
      for (const { specifier, index } of importsOf(content, repoPath, syntax)) {
        if (!specifier.startsWith('.')) {
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
      fixHint:
        'Extract private subcomponents, typed config, helpers, or a dedicated hook until the component is below the limit.',
      docsPath: 'docs/frontend-rules.md'
    },
    check({ nodeId, repoPath, content, type, projectMapRules, findingSink }) {
      if (!['component', 'main-component', 'subcomponent'].includes(type)) {
        return
      }
      if (!/\.[jt]sx$/u.test(repoPath)) {
        return
      }
      if (!isPathInRuleScope(repoPath, this, projectMapRules)) {
        return
      }
      const max = ruleOption(projectMapRules, this, 'max') ?? 200
      const lines = content.split(/\r?\n/).length
      if (lines <= max) {
        return
      }
      findingSink.add({
        ...findingBase(this),
        nodeId,
        path: repoPath,
        line: max + 1,
        message: `Component files may not exceed ${max} lines.`,
        evidence: `${lines} lines`
      })
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
      fixHint:
        'Replace with a concrete type, generic contract, discriminated union, or bounded unknown with explicit narrowing.',
      docsPath: 'docs/frontend-rules.md'
    },
    check({ nodeId, repoPath, content, syntax, findingSink }) {
      const sourceFile = syntax ?? parseTypeScript(content, repoPath)
      walkTypeScript(sourceFile, (node) => {
        if (node.kind !== ts.SyntaxKind.AnyKeyword) {
          return
        }
        const parent = node.parent
        const evidence =
          parent && ts.isAsExpression(parent)
            ? 'as any'
            : parent &&
                ts.isTypeReferenceNode(parent) &&
                ts.isIdentifier(parent.typeName) &&
                parent.typeName.text === 'Array'
              ? 'Array<any>'
              : parent && ts.isTypeAssertionExpression(parent)
                ? '<any>'
                : ': any'
        findingSink.add({
          ...findingBase(this),
          nodeId,
          path: repoPath,
          line: lineOfIndex(content, node.getStart(sourceFile)),
          evidence
        })
      })
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
      fixHint:
        'Statically import pages, use RouteConfig[] with { path, component }, and move permissions into PermissionedPage.',
      docsPath: 'docs/frontend-rules.md'
    },
    check({ nodeId, repoPath, content, syntax, type, findingSink }) {
      if (type !== 'route') {
        return
      }
      if (!repoPath.endsWith('/routes/index.tsx') && !repoPath.endsWith('/routes/index.jsx')) {
        return
      }
      const sourceFile = syntax ?? parseTypeScript(content, repoPath)
      const matches = new Map()
      walkTypeScript(sourceFile, (node) => {
        if (ts.isCallExpression(node) && typeScriptCallName(node.expression) === 'lazy') {
          matches.set('lazy()', node.expression.getStart(sourceFile))
        }
        if (ts.isIdentifier(node) && ['Suspense', 'RequirePermission', 'AccessDenied'].includes(node.text)) {
          matches.set(node.text, node.getStart(sourceFile))
        }
        if (ts.isPropertyAccessExpression(node) && node.getText(sourceFile) === 'React.ComponentType') {
          matches.set('React.ComponentType', node.getStart(sourceFile))
        }
        if (
          ts.isPropertyAssignment(node) &&
          ((ts.isIdentifier(node.name) && node.name.text === 'permission') ||
            (ts.isStringLiteralLike(node.name) && node.name.text === 'permission'))
        ) {
          matches.set('permission in route config', node.getStart(sourceFile))
        }
      })
      for (const [evidence, index] of matches) {
        findingSink.add({
          ...findingBase(this),
          nodeId,
          path: repoPath,
          line: lineOfIndex(content, index),
          evidence
        })
      }
    }
  }
]
