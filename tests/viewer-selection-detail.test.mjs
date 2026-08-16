import assert from 'node:assert/strict'
import {
  coverageDetail,
  edgeLine,
  findingsDetail,
  qualityDetail,
  reviewDetail,
  selectedNodeDetailHtml
} from '#viewer/viewer-selection.js'
import { coverageSummaryHtml, qualitySummaryHtml, traceSummaryHtml } from '#viewer/viewer-selection-summary.js'
import { state } from '#viewer/viewer-state.js'

const hostile = `<script onerror="attack">& value</script>`
const node = {
  id: 'accounts-page',
  label: `Accounts ${hostile}`,
  type: 'component',
  module: 'accounts',
  path: `front/accounts/${hostile}.tsx`,
  meta: {
    coverage: {
      hasCoverage: true,
      tests: [`front/accounts/${hostile}.test.tsx`, 'front/accounts/accounts.spec.tsx'],
      testCaseCount: 3
    },
    review: { reason: `Dynamic ${hostile}` },
    findings: [
      {
        ruleId: 'frontend.no-any',
        line: 12,
        severity: 'error',
        category: 'maintainability',
        confidence: 'high',
        effort: 'small',
        message: `Finding ${hostile}`,
        why: `Why ${hostile}`,
        fixHint: `Fix ${hostile}`,
        evidence: `Evidence ${hostile}`,
        docsPath: `docs/${hostile}.md`
      }
    ],
    quality: {
      score: 8,
      summary: `Summary ${hostile}`,
      cohesion: { score: 9, reason: `Cohesion ${hostile}` },
      coupling: { score: 7, reason: `Coupling ${hostile}` },
      calculation: {
        inputs: {
          internalRelations: 4,
          externalRelations: 2,
          outgoingDependencies: 3,
          incomingUsages: 5,
          externalModules: ['billing', 'shared']
        }
      },
      internalComponents: [{ label: `Form ${hostile}`, score: 6, summary: `Internal ${hostile}` }]
    }
  }
}

Object.assign(state, {
  graph: {
    projectMap: { frontend: { coverableTypes: ['component'] } },
    nodes: [node, { id: 'account-service', label: 'Account service' }],
    edges: []
  },
  selectedId: node.id,
  trace: {
    complete: true,
    endpointCount: 1,
    tableCount: 2,
    continuedFromAncestor: true,
    allNodeIds: new Set(['accounts-page', 'endpoint', 'table']),
    primaryNodeIds: ['accounts-page'],
    showAll: false
  }
})

const detailMarkup = selectedNodeDetailHtml(node)
assert.doesNotMatch(detailMarkup, /<script|onerror="attack"/u)
assert.match(detailMarkup, /Accounts &lt;script onerror=&quot;attack&quot;&gt;&amp; value/u)
assert.match(detailMarkup, /3 test cases/u)
assert.match(detailMarkup, /2 test files/u)
assert.match(detailMarkup, /Needs review/u)
assert.match(detailMarkup, /1 finding/u)
assert.match(detailMarkup, /Execution trace/u)
assert.match(detailMarkup, /1 endpoint/u)
assert.match(detailMarkup, /2 tables/u)
assert.match(detailMarkup, /Show all paths/u)
assert.match(detailMarkup, /External modules<\/dt><dd[^>]*>2/u)

const coverageMarkup = coverageDetail(node)
assert.match(coverageMarkup, /accounts\.spec\.tsx/u)
assert.match(coverageMarkup, /&lt;script onerror=&quot;attack&quot;/u)
assert.match(reviewDetail(node), /Dynamic &lt;script/u)

const findingsMarkup = findingsDetail(node)
for (const expected of ['error', 'maintainability', 'high confidence', 'small effort', 'Why', 'Fix', 'Evidence']) {
  assert.match(findingsMarkup, new RegExp(expected, 'u'))
}
assert.doesNotMatch(findingsMarkup, /<script/u)

const qualityMarkup = qualityDetail(node)
assert.match(qualityMarkup, /Score: 8\/10/u)
assert.match(qualityMarkup, /Internal components/u)
assert.match(qualityMarkup, /Form &lt;script/u)
assert.doesNotMatch(qualityMarkup, /<script/u)

const bareCoverable = { type: 'component', path: 'front/Bare.tsx', meta: {} }
const nonCoverable = { type: 'controller', path: 'back/Bare.cs', meta: {} }
assert.match(coverageDetail(bareCoverable), /No test found/u)
assert.equal(coverageDetail(nonCoverable), '')
assert.equal(reviewDetail(nonCoverable), '')
assert.equal(findingsDetail(nonCoverable), '')
assert.equal(qualityDetail(nonCoverable), '')

assert.match(coverageSummaryHtml(null), />Refresh</u)
assert.match(coverageSummaryHtml(1), />1</u)
assert.match(qualitySummaryHtml(node.meta.quality), /style="width:80%"/u)
assert.equal(traceSummaryHtml(null), '')
assert.match(
  traceSummaryHtml({
    complete: false,
    missingPersistence: true,
    allNodeIds: new Set(['accounts-page']),
    primaryNodeIds: ['accounts-page']
  }),
  /Persistence boundary not found/u
)
assert.match(
  traceSummaryHtml({
    complete: false,
    missingPersistence: false,
    allNodeIds: new Set(['accounts-page']),
    primaryNodeIds: ['accounts-page']
  }),
  /Frontend origin not found/u
)

const connectedMarkup = edgeLine({
  from: node.id,
  to: 'account-service',
  label: `Calls ${hostile}`,
  confidence: 'high',
  source: 'runtime',
  evidence: hostile
})
assert.match(connectedMarkup, /Account service/u)
assert.match(connectedMarkup, /high confidence/u)
assert.doesNotMatch(connectedMarkup, /<script/u)

const missingMarkup = edgeLine({ from: 'missing', to: node.id, label: 'Unknown relation' })
assert.match(missingMarkup, /data-pick="missing"/u)
assert.match(missingMarkup, />missing</u)

console.log('viewer selection detail tests passed')
