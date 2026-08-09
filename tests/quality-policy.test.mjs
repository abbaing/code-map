import assert from 'node:assert/strict'
import { Graph } from '../graph.mjs'
import { applyQualityMetrics, createQualityScoringPolicy, defaultQualityScoringPolicy } from '../quality.mjs'

const projectContext = {
  projectMap: {
    frontend: { entryPoints: [], featureFolderPattern: 'features/{module}' },
    backend: { entryPointSuffixes: [] },
    modules: { shared: 'shared' }
  }
}
const graph = new Graph()
graph.addNode('component:test', { type: 'component', module: 'test', path: 'src/test.ts', label: 'Test' })

let receivedEvidence
const customPolicy = createQualityScoringPolicy({
  score(evidence) {
    receivedEvidence = evidence
    return {
      score: 4,
      formula: 'custom',
      cohesion: { score: 3, calculation: { source: 'custom' } },
      coupling: { score: 5, calculation: { source: 'custom' } }
    }
  }
})

applyQualityMetrics(graph, projectContext, customPolicy)
assert.equal(Object.isFrozen(customPolicy), true)
assert.equal(Object.isFrozen(receivedEvidence), true)
assert.deepEqual(receivedEvidence, {
  internalRelations: 0,
  externalRelations: 0,
  outgoingDependencies: 0,
  incomingUsages: 0,
  relatedRelations: 0,
  externalModuleCount: 0,
  insideFeatureFolder: false,
  entryPoint: false
})
assert.equal(graph.getNode('component:test').meta.quality.score, 4)
assert.equal(graph.getNode('component:test').meta.quality.calculation.formula, 'custom')

const defaultResult = defaultQualityScoringPolicy.score(receivedEvidence)
assert.deepEqual(
  { score: defaultResult.score, cohesion: defaultResult.cohesion.score, coupling: defaultResult.coupling.score },
  { score: 7, cohesion: 5, coupling: 10 }
)
assert.throws(() => createQualityScoringPolicy({}), /must implement score/u)
assert.throws(() => applyQualityMetrics(graph, projectContext), /requires a QualityScoringPolicy/u)
assert.throws(() => applyQualityMetrics(graph, projectContext, { score: () => ({ score: 11 }) }), /must return scores/u)

console.log('quality scoring policy tests passed')
