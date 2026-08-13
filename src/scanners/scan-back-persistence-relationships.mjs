export function projectEntityRelationships({ graph, entityNodeByName, entityPropertiesByName }) {
  for (const [entity, properties] of entityPropertiesByName) {
    const entityId = entityNodeByName.get(entity)
    if (!entityId) {
      continue
    }
    for (const property of properties) {
      addPropertyRelationships(graph, entityId, entity, property, entityNodeByName)
    }
  }
}

function addPropertyRelationships(graph, entityId, entity, property, entityNodeByName) {
  for (const relatedEntity of property.typeNames.filter((candidate) => entityNodeByName.has(candidate))) {
    if (relatedEntity !== entity) {
      graph.addEdge(entityId, entityNodeByName.get(relatedEntity), 'domain-relation', {
        label: property.name,
        confidence: 'medium',
        source: 'entity-property-type',
        evidence: `${property.name}: ${property.type}`
      })
    }
  }
}
