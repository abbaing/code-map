import assert from 'node:assert/strict'

let input = ''
for await (const chunk of process.stdin) {
  input += chunk
}

const reports = JSON.parse(input)
assert.equal(reports.length, 1, 'npm pack must describe one package')
const report = reports[0]
const paths = report.files.map((file) => file.path)

for (const prefix of ['architecture/', 'coverage/', 'node_modules/', 'tests/']) {
  assert.equal(
    paths.some((file) => file.startsWith(prefix)),
    false,
    `published package must exclude ${prefix}`
  )
}

for (const required of [
  'LICENSE',
  'README.md',
  'cli.mjs',
  'index.d.ts',
  'index.mjs',
  'package.json',
  'presets/starter.project-map.json',
  'schemas/graph.schema.json',
  'schemas/submap-request.schema.json',
  'schemas/submap.schema.json',
  'submap/index.d.ts',
  'submap/index.mjs',
  'viewer/tailwind.css',
  'viewer/viewer.html',
  'viewer/viewer-init.js',
  'viewer/viewer-interactions.mjs'
]) {
  assert.equal(paths.includes(required), true, `published package must include ${required}`)
}

assert.equal(
  paths.some((file) => /(?:^|\/)\.\.(?:\/|$)/u.test(file)),
  false,
  'package paths must remain relative'
)
assert.equal(report.entryCount, paths.length, 'reported package entry count must match the file list')
console.log(
  `package contents verified: ${report.entryCount} files, ${report.size} bytes compressed, ${report.unpackedSize} bytes unpacked`
)
