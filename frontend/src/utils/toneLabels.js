// Plain-language labels for the tone and framing analysis.
// The backend finds these by matching words from fixed lists, so every label
// describes the WORDING of the article, never whether the article is fair.

// tone -> label, badge colour and what it means
export const TONE_LABELS = {
  neutral: {
    label: 'Neutral',
    variant: 'neutral',
    meaning: 'Few or no strong tone words were found.',
  },
  positive: {
    label: 'Positive',
    variant: 'success',
    meaning: 'Words about progress, success or solutions are more common.',
  },
  optimistic: {
    label: 'Optimistic',
    variant: 'success',
    meaning: 'Many words about progress, success or hope.',
  },
  negative: {
    label: 'Negative',
    variant: 'warning',
    meaning: 'Words about problems, losses or hardship are more common.',
  },
  critical: {
    label: 'Critical',
    variant: 'warning',
    meaning: 'Words of criticism or blame, such as "criticized" or "condemned".',
  },
  alarming: {
    label: 'Alarming',
    variant: 'danger',
    meaning: 'Words about crisis or danger, such as "disaster" or "collapse".',
  },
  contentious: {
    label: 'Contentious',
    variant: 'warning',
    meaning: 'Words about strong disagreement.',
  },
}

// frame type -> label and what it means
export const FRAME_LABELS = {
  conflict_emphasis: { label: 'Conflict', meaning: 'Presents the story as a fight or clash.' },
  blame_attribution: { label: 'Blame', meaning: 'Points to someone as responsible or at fault.' },
  urgency: { label: 'Urgency', meaning: 'Says something must happen now, or a crisis is close.' },
  emotional_language: {
    label: 'Emotional language',
    meaning: 'Uses dramatic words that make readers feel strongly.',
  },
  economic_consequence: {
    label: 'Economic cost',
    meaning: 'Tells the story through money: costs, prices or markets.',
  },
  achievement_progress: {
    label: 'Progress',
    meaning: 'Presents the story as a success, milestone or agreement.',
  },
  cooperative_progress: {
    label: 'Progress',
    meaning: 'Presents the story as a success, milestone or agreement.',
  },
  humanitarian_angle: { label: 'Human impact', meaning: 'Focuses on how people are affected.' },
  security_threat: { label: 'Security threat', meaning: 'Focuses on danger or defence.' },
  loaded_language: { label: 'Loaded words', meaning: 'Uses words that carry a judgement.' },
}

export function toneInfo(tone) {
  return TONE_LABELS[tone] || { label: 'Not given', variant: 'neutral', meaning: null }
}

// "some_new_frame" -> "Some new frame" when the backend sends a type we don't know
export function frameInfo(frame) {
  if (FRAME_LABELS[frame]) return FRAME_LABELS[frame]
  if (!frame) return { label: 'Not given', meaning: null }
  const words = frame.replace(/_/g, ' ')
  return { label: words.charAt(0).toUpperCase() + words.slice(1), meaning: null }
}

// 0.76 -> "76%"
export function formatPercent(score) {
  return score === null || score === undefined ? 'Not given' : `${Math.round(score * 100)}%`
}

// -0.8 -> "−0.80", 0.35 -> "+0.35"
export function formatToneScore(score) {
  if (score === null || score === undefined) return 'Not given'
  if (score === 0) return '0.00'
  return `${score > 0 ? '+' : '−'}${Math.abs(score).toFixed(2)}`
}
