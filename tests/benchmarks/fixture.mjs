import fs from 'node:fs'
import path from 'node:path'

export const BENCHMARK_SIZES = Object.freeze([1000, 5000, 20000])

export function createBenchmarkProject(root, fileCount) {
  const sourceRoot = path.join(root, 'src')
  fs.mkdirSync(sourceRoot, { recursive: true })
  for (let index = 0; index < fileCount; index += 1) {
    const moduleDirectory = path.join(sourceRoot, `module-${index % 20}`)
    fs.mkdirSync(moduleDirectory, { recursive: true })
    const previous =
      index === 0 ? '' : `import { value as previous } from '../module-${(index - 1) % 20}/file-${index - 1}'\n`
    const value = index === 0 ? index : `previous + ${index}`
    fs.writeFileSync(
      path.join(moduleDirectory, `file-${index}.ts`),
      `${previous}export const value = ${value}\n`,
      'utf8'
    )
  }
  fs.writeFileSync(path.join(root, 'project-map.json'), `${JSON.stringify(projectMap(), null, 2)}\n`, 'utf8')
}

function projectMap() {
  return {
    schemaVersion: 1,
    project: { name: 'Benchmark fixture', graphOutput: '.code-map/graph.json' },
    sourceRoots: { frontend: 'src' },
    modules: { frontendFeaturePattern: '^src/(module-[^/]+)' },
    templates: { enabled: ['filesystem', 'typescript', 'react', 'quality'] }
  }
}
