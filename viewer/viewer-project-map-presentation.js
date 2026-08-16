import { colors, layerLabels, layerOrder, moduleLabels, state, typeLabels } from '#viewer/viewer-state.js'
import { replaceRuleLabels } from '#viewer/viewer-utils.js'

export function applyProjectMap(projectMap = {}) {
  replaceObject(moduleLabels, projectMap.modules?.labels)
  replaceObject(layerLabels, Object.fromEntries((projectMap.layers ?? []).map((layer) => [layer.id, layer.label])))
  replaceObject(typeLabels, projectMap.types?.labels)
  replaceObject(colors, projectMap.types?.colors)
  replaceRuleLabels(
    Object.fromEntries(
      Object.entries(state.graph?.ruleMetadata ?? {})
        .filter(([, metadata]) => metadata.label)
        .map(([id, metadata]) => [id, metadata.label])
    )
  )
  layerOrder.splice(0, layerOrder.length, ...(projectMap.layers ?? []).map((layer) => layer.id))
}

function replaceObject(target, source = {}) {
  for (const key of Object.keys(target)) {
    delete target[key]
  }
  Object.assign(target, source)
}
