import fs from 'node:fs'
import path from 'node:path'

const metrics = ['lines', 'statements', 'branches', 'functions']
const groups = [
  {
    id: 'application',
    includes: (file) =>
      !file.includes('/') || ['src/', 'rules/', 'submap/', 'templates/'].some((prefix) => file.startsWith(prefix)),
    thresholds: { lines: 78, statements: 78, branches: 77, functions: 80 }
  },
  {
    id: 'server',
    includes: (file) => file === 'server.mjs',
    thresholds: { lines: 86, statements: 86, branches: 83, functions: 100 }
  },
  {
    id: 'viewer',
    includes: (file) => file.startsWith('viewer/'),
    thresholds: { lines: 54, statements: 54, branches: 69, functions: 61 }
  },
  {
    id: 'platform',
    includes: (file) => file.startsWith('platform/'),
    thresholds: { lines: 90, statements: 90, branches: 90, functions: 85 }
  },
  {
    id: 'architecture',
    includes: (file) => file.startsWith('architecture/'),
    thresholds: { lines: 99, statements: 99, branches: 100, functions: 50 }
  }
]

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
