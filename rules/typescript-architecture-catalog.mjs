import {
  importsOf,
  parseTypeScript,
  typeScriptCallName,
  typescript as ts,
  walkTypeScript
} from '#parsers/typescript.mjs'
import { findingBase, lineOfIndex, ruleOption } from '#rules/rule-runner.mjs'
import {
  featureFromPath,
  featureFromSpecifier,
  isAllowedFeatureImport,
  isAllowedEntryPath,
  isPathInRuleScope,
  isUiImport,
  matchesAny,
  orchestrationSignals
} from '#rules/typescript-architecture-policy.mjs'

export const TYPESCRIPT_ARCHITECTURE_RULES = Object.freeze([
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
  }
])
