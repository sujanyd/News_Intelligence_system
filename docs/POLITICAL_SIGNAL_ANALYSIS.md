# Political and Party-Leaning Signal Analysis

## 1. Overview and Ethical Principles

The **Political and Party-Leaning Signal Analysis** module provides automated, evidence-backed evaluation of how news articles present political parties, elected representatives, candidates, and political institutions.

### Core Principles
1. **Mentioning $\neq$ Endorsement**: Simply quoting or reporting on a politician or political party does not mean the article or news outlet supports that entity.
2. **Tone $\neq$ Ideology**: A negative tone does not equate to partisan bias; articles reporting on government scandals, crises, or economic hardship will naturally carry negative affect.
3. **Evidence-Based Grounding**: Every identified presentation signal requires verbatim textual evidence, character offsets (`start_char`, `end_char`), and a traceable explanation.
4. **Estimates, Not Objective Facts**: All leaning classifications and slant metrics are analytical approximations, not definitive determinations of editorial bias.
5. **Separation of Article vs. Publisher**: An individual article reporting on a political dispute does not categorize the publisher as systematically biased without multi-article comparative analysis.

---

## 2. Taxonomy and Classifications

### Political Entity Categories
- `POLITICAL_PARTY`: Major national and international political organizations (e.g. *Democratic Party*, *Republican Party*, *Labour Party*, *Conservative Party*).
- `POLITICIAN`: Public representatives, ministers, heads of state, senators, and candidates (e.g. *Joe Biden*, *Donald Trump*, *Keir Starmer*).
- `POLITICAL_ORGANIZATION`: Legislative bodies, executive agencies, or institutional committees (e.g. *United States Congress*, *The White House*, *European Commission*).

### Political Presentation Categories
- `favorable`: Language celebrating achievements, policy breakthroughs, or broad support.
- `unfavorable`: Language emphasizing severe failure, criticism, controversy, or misconduct.
- `neutral`: Objective, descriptive reporting without overt praise or censure cues.
- `mixed`: Balanced representation with both favorable arguments and opposing scrutiny.

### Ideological Slant Scale
Continuous slant score mapped to discrete leaning labels:
- `left`: $\le -0.45$
- `center-left`: $-0.45 < \text{score} \le -0.15$
- `center`: $-0.15 < \text{score} < +0.15$
- `center-right`: $+0.15 \le \text{score} < +0.45$
- `right`: $\ge +0.45$

---

## 3. Database Schema Mapping

Existing database models are reused without creating redundant tables:

### `ENTITY` (`entities`)
- Stores canonical definitions (`name`, `entity_type: PERSON | ORGANIZATION | GOVERNMENT`).
- Reused across all articles to prevent duplicate entity rows.

### `ANALYSIS_ENTITY` (`analysis_entities`)
- Connects an `ArticleAnalysis` record with an `Entity`.
- Tracks `mention_count`, local `sentiment_score` (-1.0 to +1.0), and `role`.

### `ARTICLE_ANALYSIS` (`article_analyses`)
- Updates `bias_score` (-1.0 Far-Left to +1.0 Far-Right).
- Updates `bias_label` (`left`, `center-left`, `center`, `center-right`, `right`).
- Stores analytical summary in `summary`.

### `COMPARISON_POLITICAL_SIGNAL` (`comparison_political_signals`)
- Enforces composite foreign key on `(comparison_id, article_id)` targeting `comparison_articles`.
- Stores `political_leaning`, `slant_score`, `partisanship_score`, and `signal_description`.

---

## 4. REST API Reference

All routes are mounted with dual prefixes: `/api/` and `/api/v1/`.

### Article Endpoints
- `GET /api/articles/{article_id}/political-signals`: Comprehensive political leaning, slant, partisanship, and evidence signals.
- `POST /api/articles/{article_id}/political-signals/analyze`: Trigger or force re-analysis (`{"force_reanalyze": true, "comparison_id": null}`).
- `GET /api/articles/{article_id}/political-entities`: List of political parties, politicians, and organizations identified in the article.
- `GET /api/articles/{article_id}/political-evidence`: List of specific sentences serving as evidence for political presentation.

### Comparison Endpoints
- `GET /api/comparisons/{comparison_id}/political-signals`: Cross-outlet comparative analysis summarizing ideological divergence and convergence across all articles in a comparison session.

---

## 5. Sample API Response

### `GET /api/articles/1/political-signals`

```json
{
  "article_id": 1,
  "headline": "President Biden Championed Landmark Reform with Broad Support",
  "political_leaning": "center-left",
  "slant_score": -0.28,
  "partisanship_score": 0.65,
  "confidence_score": 0.85,
  "signal_description": "Identified 2 political presentation cues across 3 political entities (2 favorable, 0 unfavorable). Coverage exhibits an estimated 'center-left' ideological orientation.",
  "political_entities": [
    {
      "id": 1,
      "name": "Democratic Party",
      "entity_type": "ORGANIZATION",
      "political_category": "POLITICAL_PARTY",
      "ideological_affiliation": "Democratic Party",
      "mention_count": 1,
      "salience_score": 0.5,
      "sentiment_score": 0.6,
      "presentation": "favorable"
    },
    {
      "id": 2,
      "name": "Joe Biden",
      "entity_type": "PERSON",
      "political_category": "POLITICIAN",
      "ideological_affiliation": "Democratic Party",
      "mention_count": 1,
      "salience_score": 0.5,
      "sentiment_score": 0.6,
      "presentation": "favorable"
    }
  ],
  "signals": [
    {
      "entity_id": 1,
      "entity_name": "Democratic Party",
      "political_category": "POLITICAL_PARTY",
      "treatment": "favorable",
      "framing_technique": "praise_achievement",
      "intensity_score": 0.75,
      "confidence_score": 0.82,
      "evidence_text": "The Democratic Party celebrated a historic achievement today in Washington as President Joe Biden championed a landmark reform package.",
      "start_char": 0,
      "end_char": 136,
      "explanation": "Entity 'Democratic Party' presented favorably via cue 'celebrated'."
    }
  ],
  "analyzed_at": "2026-11-08T17:15:30.123456Z"
}
```

---

## 6. Test Suite Verification

Run the dedicated test suite:
```bash
.venv/bin/pytest tests/test_political_signal.py -v
```

All 16 unit, integration, and endpoint tests pass, validating entity deduplication, signal extraction, database relationships, and REST APIs.
