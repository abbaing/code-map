import { loadProjectContext, validateProjectMap } from './config.mjs'
import { writeFileAtomic, writeJsonFileAtomic } from './json-io.mjs'
import { writeGraph } from './scan.mjs'
import { createSubmap, defaultSubmapFilename } from './submap/index.mjs'
import { nodeSubmapRepository } from './submap/io.mjs'

export const nodeServerApplicationServices = Object.freeze({
  scanner: Object.freeze({ scan: writeGraph }),
  projectMaps: Object.freeze({
    validate: validateProjectMap,
    load: loadProjectContext,
    write: writeJsonFileAtomic,
    restore: writeFileAtomic
  }),
  submaps: Object.freeze({
    create: createSubmap,
    filename: defaultSubmapFilename,
    write: nodeSubmapRepository.write
  })
})
