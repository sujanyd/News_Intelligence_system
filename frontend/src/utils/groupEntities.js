// The entity types the backend uses, in the order they are shown.
// Any other type (for example CONCEPT) goes in the "Other" group.
const ENTITY_GROUPS = [
  { type: 'PERSON', label: 'People' },
  { type: 'ORGANIZATION', label: 'Organizations' },
  { type: 'LOCATION', label: 'Locations' },
]

// "CONCEPT" -> "Concept", "WORK_OF_ART" -> "Work of art"
export function formatEntityType(type) {
  const words = type.toLowerCase().replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// Puts the entities into the groups above, most mentioned first
export function groupEntities(entities) {
  const byMentions = [...entities].sort(
    (a, b) => (b.mention_count ?? 0) - (a.mention_count ?? 0)
  )
  const knownTypes = ENTITY_GROUPS.map((group) => group.type)
  const groups = ENTITY_GROUPS.map((group) => ({
    ...group,
    entities: byMentions.filter((entity) => entity.type === group.type),
  }))
  groups.push({
    type: 'OTHER',
    label: 'Other',
    entities: byMentions.filter((entity) => !knownTypes.includes(entity.type)),
  })
  return groups.filter((group) => group.entities.length > 0)
}
