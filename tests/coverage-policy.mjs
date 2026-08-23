import fs from 'node:fs'
import path from 'node:path'

const metrics = ['lines', 'statements', 'branches', 'functions']
const groups = [
  {
    id: 'application',
    includes: (file) =>
      !file.includes('/') || ['src/', 'rules/', 'submap/', 'templates/'].some((prefix) => file.startsWith(prefix)),
    thresholds: { lines: 92, statements: 92, branches: 85, functions: 95 }
  },
  {
    id: 'server',
    includes: (file) => file === 'server.mjs' || file.startsWith('src/delivery/'),
    thresholds: { lines: 93, statements: 93, branches: 89, functions: 100 }
  },
  {
    id: 'submap',
    includes: (file) => file.startsWith('submap/'),
    thresholds: { lines: 88, statements: 88, branches: 86, functions: 93 }
  },
  {
    id: 'viewer',
    includes: (file) => file.startsWith('viewer/'),
    thresholds: { lines: 83, statements: 83, branches: 77, functions: 85 }
  },
  {
    id: 'platform',
    includes: (file) => file.startsWith('platform/'),
    thresholds: { lines: 93, statements: 93, branches: 93, functions: 94 }
  },
  {
    id: 'architecture',
    includes: (file) => file.startsWith('architecture/'),
    thresholds: { lines: 99, statements: 99, branches: 100, functions: 50 }
  },
  {
    id: 'mcp',
    includes: (file) => file === 'mcp-server.mjs' || file.startsWith('mcp/'),
    thresholds: { lines: 85, statements: 85, branches: 75, functions: 90 }
  }
]

const criticalFiles = {
  'submap/cli-diff.mjs': { lines: 90, functions: 100 },
  'viewer/viewer-actions-settings.js': { lines: 45, functions: 40 },
  'viewer/viewer-layout-domain-grid.js': { lines: 90, functions: 100 },
  'viewer/viewer-overview.js': { lines: 70, functions: 65 }
}

const reportPath = path.resolve('coverage/coverage-summary.json')
const summary = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
const files = Object.entries(summary)
  .filter(([file]) => file !== 'total')
  .map(([file, coverage]) => [path.relative(process.cwd(), file).split(path.sep).join('/'), coverage])

for (const group of groups) {
  const selected = files.filter(([file]) => group.includes(file))
  if (selected.length === 0) {
    throw new Error(`Coverage group ${group.id} contains no files.`)
  }

  const coverage = Object.fromEntries(metrics.map((metric) => [metric, aggregate(selected, metric)]))
  for (const metric of metrics) {
    if (coverage[metric] < group.thresholds[metric]) {
      throw new Error(
        `${group.id} ${metric} coverage ${coverage[metric].toFixed(2)}% is below ${group.thresholds[metric]}%.`
      )
    }
  }
  console.log(
    `${group.id} coverage passed: ${metrics.map((metric) => `${metric} ${coverage[metric].toFixed(2)}%`).join(', ')}`
  )
}

for (const [file, thresholds] of Object.entries(criticalFiles)) {
  const coverage = files.find(([candidate]) => candidate === file)?.[1]
  if (!coverage) {
    throw new Error(`Critical coverage file ${file} is missing from the report.`)
  }
  for (const [metric, threshold] of Object.entries(thresholds)) {
    if (coverage[metric].pct < threshold) {
      throw new Error(`${file} ${metric} coverage ${coverage[metric].pct}% is below ${threshold}%.`)
    }
  }
  console.log(
    `${file} critical coverage passed: ${Object.keys(thresholds)
      .map((metric) => `${metric} ${coverage[metric].pct.toFixed(2)}%`)
      .join(', ')}`
  )
}

function aggregate(entries, metric) {
  const totals = entries.reduce(
    (result, [, coverage]) => ({
      total: result.total + coverage[metric].total,
      covered: result.covered + coverage[metric].covered
    }),
    { total: 0, covered: 0 }
  )
  return totals.total === 0 ? 100 : (totals.covered / totals.total) * 100
}
