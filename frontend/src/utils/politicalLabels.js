// Plain-language labels for the political analysis.
// The backend finds these with fixed word lists, so the labels describe the
// WORDING near a name ("critical wording"), never the publisher's politics.

export const CATEGORY_LABELS = {
  POLITICIAN: 'Politician',
  POLITICAL_PARTY: 'Political party',
  POLITICAL_ORGANIZATION: 'Political organization',
}

// presentation / treatment -> label and badge colour
export const PRESENTATION_LABELS = {
  favorable: { label: 'Favorable wording', variant: 'success' },
  unfavorable: { label: 'Critical wording', variant: 'danger' },
  mixed: { label: 'Mixed wording', variant: 'warning' },
  // The backend also says "neutral" when it found no signal at all
  neutral: { label: 'No clear signal', variant: 'neutral' },
}

export function categoryLabel(category) {
  return CATEGORY_LABELS[category] || 'Political (type not given)'
}

// "harsh_criticism" -> "Harsh criticism"
export function formatTechnique(technique) {
  if (!technique) return 'Not given'
  const words = technique.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// Names are compared without upper/lower case and extra spaces
function nameKey(name) {
  return name.trim().toLowerCase()
}

/**
 * Lines up two articles' political analyses by entity name.
 *
 * @param {{ entities: Array, signals: Array }} analysisA
 * @param {{ entities: Array, signals: Array }} analysisB
 * @returns {{ shared: Array<{ name, category, a: { entity, signals }, b: { entity, signals } }>,
 *   onlyA: Array, onlyB: Array }}
 *   shared: entities found in both articles (A's order)
 *   onlyA / onlyB: entities found in only one of them
 */
export function compareCoverage(analysisA, analysisB) {
  const signalsFor = (analysis, name) =>
    analysis.signals.filter((signal) => nameKey(signal.entity_name) === nameKey(name))

  const entitiesB = new Map(analysisB.entities.map((entity) => [nameKey(entity.name), entity]))
  const namesA = new Set(analysisA.entities.map((entity) => nameKey(entity.name)))

  const shared = []
  const onlyA = []
  for (const entityA of analysisA.entities) {
    const entityB = entitiesB.get(nameKey(entityA.name))
    if (!entityB) {
      onlyA.push(entityA)
      continue
    }
    shared.push({
      name: entityA.name,
      category: entityA.political_category || entityB.political_category,
      a: { entity: entityA, signals: signalsFor(analysisA, entityA.name) },
      b: { entity: entityB, signals: signalsFor(analysisB, entityB.name) },
    })
  }
  const onlyB = analysisB.entities.filter((entity) => !namesA.has(nameKey(entity.name)))

  return { shared, onlyA, onlyB }
}
