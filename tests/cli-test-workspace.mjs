import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const testDir = path.dirname(fileURLToPath(import.meta.url))
export const packageRoot = path.resolve(testDir, '..')
export const cliPath = path.join(packageRoot, 'cli.mjs')
export const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'code-map-cli-'))
export const appRoot = path.join(tempRoot, 'app')
export const arbitraryRoot = path.join(tempRoot, 'arbitrary')
export const arbitraryConfigDir = path.join(arbitraryRoot, 'code-map')
export const arbitraryConfigPath = path.join(arbitraryConfigDir, 'project-map.json')
export const arbitraryGraphPath = path.join(arbitraryConfigDir, 'graph.json')

prepareDetectedApplication()
prepareConfiguredApplication()
process.once('exit', () => fs.rmSync(tempRoot, { recursive: true, force: true }))

function prepareDetectedApplication() {
  fs.mkdirSync(path.join(appRoot, 'src'), { recursive: true })
  fs.writeFileSync(
    path.join(appRoot, 'package.json'),
    JSON.stringify({ name: 'cli-smoke-app', dependencies: { react: '18.0.0', 'react-dom': '18.0.0' } }),
    'utf8'
  )
  fs.writeFileSync(path.join(appRoot, 'src/index.tsx'), 'export function App() { return null }\n', 'utf8')
}

function prepareConfiguredApplication() {
  const templatesDirectory = path.join(arbitraryConfigDir, 'templates')
  const outsideSourceRoot = path.join(tempRoot, 'outside-source')
  fs.mkdirSync(path.join(arbitraryRoot, 'src'), { recursive: true })
  fs.mkdirSync(templatesDirectory, { recursive: true })
  fs.mkdirSync(outsideSourceRoot)
  fs.symlinkSync(
    outsideSourceRoot,
    path.join(arbitraryRoot, 'linked-outside'),
    process.platform === 'win32' ? 'junction' : 'dir'
  )
  fs.writeFileSync(path.join(arbitraryRoot, 'src/index.ts'), 'export const arbitraryValue = 1\n', 'utf8')
  fs.writeFileSync(
    path.join(templatesDirectory, 'custom-plugin.mjs'),
    "export const customPluginTemplate = { id: 'custom-plugin', stage: 'custom', description: 'Test plugin loaded relative to config.' }\n",
    'utf8'
  )
  fs.writeFileSync(arbitraryConfigPath, `${JSON.stringify(arbitraryConfig(), null, 2)}\n`, 'utf8')
}

function arbitraryConfig() {
  return {
    schemaVersion: 1,
    project: {
      name: 'Arbitrary Config App',
      graphOutput: 'graph.json',
      runtimeLinks: 'code-map/runtime-links.json'
    },
    sourceRoots: { frontend: 'src' },
    templates: {
      enabled: ['filesystem', 'typescript', 'react', 'custom-plugin', 'quality'],
      plugins: ['./templates/custom-plugin.mjs']
    },
    imports: { aliases: [] },
    modules: { shared: 'shared', frontendFeaturePattern: '^$', labels: {} },
    layers: [{ id: 'auxiliary', label: 'Auxiliary' }],
    frontend: { entryPoints: [], classifiers: [], coverableTypes: [] },
    rules: { enabled: [], options: {}, suppressions: [] }
  }
}
