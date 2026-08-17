import { loadProjectContext, validateProjectMap } from '#core/config.mjs'
import { nodeTextWriter, writeFileAtomic, writeJsonFileAtomic } from '#node/json-io.mjs'
import { writeGraph } from '#app/scan.mjs'
import { createSubmap, defaultSubmapFilename, validateSubmap } from '#submap/index.mjs'
import { nodeSubmapRepository } from '#submap/io.mjs'
import { buildTemplateRegistry } from '#templates/registry.mjs'

export const nodeServerApplicationServices = Object.freeze({
  scanner: Object.freeze({
    scan(outputPath, projectContext, options = {}) {
      return writeGraph(outputPath, projectContext, {
        registry: buildTemplateRegistry(projectContext.projectMap),
        writer: nodeTextWriter,
        ...options
      })
    }
  }),
  projectMaps: Object.freeze({
    validate: validateProjectMap,
    load: loadProjectContext,
    write: writeJsonFileAtomic,
    restore: writeFileAtomic
  }),
  submaps: Object.freeze({
    create: createSubmap,
    filename: defaultSubmapFilename,
    list: nodeSubmapRepository.list,
    read: nodeSubmapRepository.read,
    validate: validateSubmap,
    write: nodeSubmapRepository.write
  })
})
