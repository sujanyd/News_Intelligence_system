# Tone and Framing Analysis

## 1. Overview and Architecture

The **Tone and Framing Analysis** module evaluates news articles for emotional sentiment/affect and narrative framing techniques without conflating them into ungrounded claims of political bias.

News reporting often features subtle rhetorical positioning:
- **Tone**: The emotional valence and intensity of the language (e.g., *neutral*, *positive*, *negative*, *critical*, *alarming*, *optimistic*).
- **Framing**: The interpretive lens or angle through which an issue or event is structured (e.g., *conflict emphasis*, *blame attribution*, *urgency*, *economic consequences*, *cooperative progress*).

This module strictly distinguishes between tone and framing:
- A negative tone does not necessarily indicate unfair bias (e.g., reporting on a natural disaster or aviation accident is naturally negative and alarming).
- Framing analysis preserves exact verbatim textual evidence, character boundary offsets (`start_char`, `end_char`), and intensity scores.
- All model and rule outputs are explicitly identified as **analytical estimates**, not objective truths.

---

## 2. Taxonomy & Categories

### Tone Categories
- `neutral`: Objective, descriptive reporting with minimal emotional rhetoric (valence around `0.0`, score between `-0.25` and `+0.25`).
- `positive`: Highlights favorable progress, solutions, stabilization, or accomplishments (`+0.25` to `+0.70`).
- `optimistic`: Forward-looking positive predictions and elevated confidence (`+0.70` to `+1.00`).
- `negative`: Adverse circumstances, downturns, distress, or hardships (`-0.25` to `-0.60`).
- `critical`: Evaluative censure, scrutiny, denunciation, or accountability allegations (`-0.50` to `-0.85`).
- `alarming`: Crisis-driven, catastrophic risk, or panic-inducing vocabulary (`-0.70` to `-1.00`).

### Headline Framing Categories
- `neutral_reporting`: Factual and balanced description of the event.
- `conflict_emphasis`: Highlights friction, confrontation, clashes, or division between opposing parties.
- `urgency`: Emphasizes ticking clocks, looming deadlines, emergency action, or crisis points.
- `blame_attribution`: Directs culpability, finger-pointing, or responsibility toward specific actors.
- `emotional_language`: Employs loaded, sensational, or shocking adjectives to trigger reader reactions.
- `economic_consequence`: Frames developments primarily through monetary costs, financial burdens, or market disruptions.
- `achievement_progress`: Emphasizes breakthroughs, milestones, or cooperative consensus.
- `security_threat`: Frames developments around national security, defense vulnerabilities, or external threats.

### Framing Signals & Evidence Spans
Each framing signal extracted from headline or body text captures:
- `frame_type`: Standardized frame category name.
- `intensity_score`: Normalized intensity between `0.0` and `1.0`.
- `evidence_text`: Verbatim sentence or phrase containing the rhetorical cue.
- `start_char` & `end_char`: 0-indexed character offsets inside the article text.
- `explanation`: Contextual description citing the exact lexical trigger.

---

## 3. Database Schema Mapping

Existing production tables and models are reused without table duplication:

### `ARTICLE_ANALYSIS`
- `article_id`: Foreign key reference to `articles.id`.
- `sentiment_score`: Float between `-1.0` and `+1.0` representing continuous emotional valence.
- `sentiment_label`: Discrete tone classification (`neutral`, `positive`, `critical`, etc.).
- `confidence_score`: Float between `0.0` and `1.0`.
- `summary`: Contextual synthesis explaining the combined tone and framing findings.

### `ANALYSIS_FRAMING_SIGNAL`
- `analysis_id`: Foreign key reference to `article_analysis.id`.
- `frame_type`: String identifier (e.g., `conflict_emphasis`, `blame_attribution`).
- `intensity_score`: Float between `0.0` and `1.0`.
- `evidence_text`: Verbatim extracted sentence or phrase.
- `start_char`: Start character offset in the source text.
- `end_char`: End character offset in the source text.
- `explanation`: Traceable justification for the signal.

---

## 4. REST API Endpoints

All endpoints are mounted with dual route prefixes: `/api/articles` and `/api/v1/articles`.

### 1. Full Tone and Framing Overview
`GET /api/articles/{article_id}/tone-framing`
- Retrieves comprehensive tone classification, headline framing, and all evidence framing signals.
- Automatically generates analysis if not previously computed.

### 2. Force Re-analysis
`POST /api/articles/{article_id}/tone-framing/analyze`
- Accepts `{"force_reanalyze": true}` to re-evaluate and overwrite existing analysis records.

### 3. Article Tone Only
`GET /api/articles/{article_id}/tone`
- Returns `tone`, `tone_score`, `confidence`, `subjectivity_score`, and `explanation`.

### 4. Headline Framing Only
`GET /api/articles/{article_id}/headline-framing`
- Returns `headline`, `primary_frame`, `detected_frames`, `confidence`, `evidence_phrases`, and `explanation`.

### 5. Framing Signals Only
`GET /api/articles/{article_id}/framing-signals`
- Returns a list of all extracted framing signals with character offsets and verbatim evidence text.

---

## 5. Sample API Response

### `GET /api/articles/1/tone-framing`

```json
{
  "article_id": 1,
  "analysis_id": 1,
  "headline": "Opposition leaders slam government policy amid severe crisis and rising costs",
  "tone": {
    "tone": "alarming",
    "tone_score": -0.85,
    "confidence": 0.82,
    "subjectivity_score": 0.44,
    "explanation": "Tone categorized as 'alarming' due to prominent crisis/danger vocabulary (2 alarming occurrences)."
  },
  "headline_framing": {
    "headline": "Opposition leaders slam government policy amid severe crisis and rising costs",
    "primary_frame": "conflict_emphasis",
    "detected_frames": [
      "conflict_emphasis",
      "urgency",
      "blame_attribution",
      "economic_consequence"
    ],
    "confidence": 0.92,
    "evidence_phrases": [
      "slam",
      "severe crisis",
      "rising costs"
    ],
    "explanation": "Headline exhibits 'conflict_emphasis' framing (evidence: ['slam', 'severe crisis', 'rising costs']). Highlights friction, opposition, or adversarial confrontation."
  },
  "framing_signals": [
    {
      "id": 1,
      "analysis_id": 1,
      "frame_type": "conflict_emphasis",
      "intensity_score": 0.85,
      "evidence_text": "Opposition leaders slam government policy amid severe crisis and rising costs",
      "start_char": 0,
      "end_char": 74,
      "explanation": "Headline cue 'slam': Emphasizes dispute, confrontation, or adversarial division."
    },
    {
      "id": 2,
      "analysis_id": 1,
      "frame_type": "blame_attribution",
      "intensity_score": 0.85,
      "evidence_text": "Opposition lawmakers have fiercely condemned the new administrative decree, blaming senior ministers for an escalating financial disaster.",
      "start_char": 0,
      "end_char": 139,
      "explanation": "Text cue 'blaming': Attributes culpability, fault, or responsibility for adverse outcomes."
    },
    {
      "id": 3,
      "analysis_id": 1,
      "frame_type": "urgency",
      "intensity_score": 0.8,
      "evidence_text": "The administration must act immediately to prevent severe financial collapse.",
      "start_char": 213,
      "end_char": 290,
      "explanation": "Text cue 'act immediately': Frames circumstances as requiring immediate action or under imminent threat."
    }
  ],
  "summary": "Article tone assessed as 'alarming' with valence -0.85. Headline framed via 'conflict_emphasis'. Identified 3 evidence-backed narrative framing signals across coverage.",
  "analyzed_at": "2026-11-07T13:57:19.452012Z"
}
```

---

## 6. Verification and Testing

Run test suite:
```bash
.venv/bin/pytest tests/test_tone_and_framing.py -v
```

All 11 unit and integration tests validate:
1. Tone valence scoring and discrete classification across neutral, positive, critical, and alarming texts.
2. Headline framing detection with rhetorical cue extraction.
3. Accurate sentence-level framing signal discovery with strict character offsets.
4. Database persistence into `ARTICLE_ANALYSIS` and `ANALYSIS_FRAMING_SIGNAL`.
5. REST API responses and HTTP status handling across endpoints.
