import { createDetectionFiles, detect as detectProjectMap, detectSummary as summarizeProject } from './detect.mjs'
import { nodePlatform } from './platform/node.mjs'

export function detect(repoRoot, { fileSystem = nodePlatform.fileSystem, detectors } = {}) {
  return detectProjectMap(repoRoot, { files: createDetectionFiles(fileSystem), detectors })
}

export function detectSummary(repoRoot, { fileSystem = nodePlatform.fileSystem, detectors } = {}) {
  return summarizeProject(repoRoot, { files: createDetectionFiles(fileSystem), detectors })
}
