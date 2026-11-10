# AI Models, Statistical Heuristics & Methodological Limitations

## 1. Overview
The Multi-Source News Intelligence System employs a hybrid intelligence architecture combining:
1. **Sentence Transformers / Embeddings** for semantic indexing and vector similarity.
2. **Deterministic & Rule-Based NLP Parsers** for entity, topic, quote, and fact extraction.
3. **Statistical Text Geometry & Burstiness Modeling** for AI-generated text likelihood estimation.
4. **Calibrated Sentiment & Lexicon Analyzers** for framing and tone identification.

This document formalizes the algorithms, mathematical metrics, calibration procedures, and inherent limitations of each analytical subsystem.

---

## 2. AI-Generated News Detection Model

### 2.1 Theoretical Basis: Perplexity & Burstiness
Natural human prose—particularly professional journalism—exhibits pronounced **burstiness**: variation in sentence length, rhythmic punctuation, dynamic clause complexity, and vocabulary shifts. In contrast, standard auto-regressive large language models (LLMs) sampling via greedy, nucleus, or temperature decoding generate text that concentrates near high-probability paths, producing unnatural sentence length uniformity and predictable lexical distribution.

### 2.2 Mathematical Formulations

#### 1. Sentence Length Burstiness ($B$)
Burstiness is modeled as the coefficient of variation ($CV$) of sentence token counts:
$$CV = \frac{\sigma_L}{\mu_L}$$
where $\mu_L$ is the mean sentence length in words and $\sigma_L$ is the standard deviation:
$$\sigma_L = \sqrt{\frac{1}{N} \sum_{i=1}^N (L_i - \mu_L)^2}$$
- Low $CV$ ($CV < 0.25$): High pacing uniformity $\to$ elevated synthetic probability.
- High $CV$ ($CV \ge 0.50$): Diverse pacing $\to$ indicative of natural human writing.

#### 2. Lexical Diversity ($LD$)
Evaluated using the Type-Token Ratio ($TTR$):
$$TTR = \frac{|V|}{N_{total}}$$
where $|V|$ is the number of unique normalized word lemmas and $N_{total}$ is the total word count.

#### 3. Repetition Index ($RI$)
Quantifies bigram recurrence indicative of repetitive prompt completions:
$$RI = 1 - \frac{|\text{unique bigrams}|}{|\text{total bigrams}|}$$

### 2.3 Likelihood Scoring & Clamping
The raw composite score is aggregated:
$$S_{raw} = 0.5 \cdot \max(0, 1 - 2 \cdot B) + 0.3 \cdot \max(0, 1 - 2 \cdot LD) + 0.2 \cdot \min(1, 4 \cdot RI)$$

To reflect real-world probabilistic uncertainty and prevent overconfident false attributions:
$$P_{final} = \text{clamp}(S_{raw}, 0.02, 0.95)$$

### 2.4 Ethical Guardrails & Review Status
- **Review Threshold**: When $P_{final} \ge 0.70$, the article is flagged (`flagged_for_review = True`, `review_status = "flagged"`).
- **Mandatory Disclaimer**: Every response and downstream report includes the disclaimer:
  > *"This score is an empirical likelihood estimate based on statistical text modeling and burstiness variance. It does not provide absolute factual certainty."*

---

## 3. Embedding & Matching Models

### 3.1 Model Architecture
- **Default Embedding Model**: `all-MiniLM-L6-v2` (384-dimensional dense vectors) via `sentence-transformers`.
- **Fallback / Local Offline Mode**: Deterministic TF-IDF / character n-gram cosine matching when running in isolated environments without GPU acceleration.
- **Vector Search Engine**: Qdrant with HNSW cosine distance indexing (`collections/articles`).

### 3.2 Matching Taxonomy
- **SAME_EVENT**: Cosine similarity $\ge 0.82$ with high entity co-occurrence ($> 0.60$).
- **RELATED_TOPIC**: Cosine similarity between $0.60$ and $0.82$.
- **DIFFERENT**: Cosine similarity $< 0.60$.

---

## 4. Tone & Framing Extraction

### 4.1 Tone Categorization
- Categories: `neutral`, `positive`, `negative`, `critical`, `alarming`, `optimistic`.
- Tone confidence is computed via keyword density, valence scoring, and modal verb frequency.

### 4.2 Framing Signals
- Framing dimensions: `conflict_emphasis`, `economic_impact`, `human_interest`, `blame_attribution`, `urgency`, `patriotic_solidarity`.
- Every signal requires an exact verbatim quotation stored in `evidence_text`.

---

## 5. Limitations & Edge Cases

1. **Short Articles (< 4 sentences)**:
   Burstiness calculations have high variance on extremely short texts. The engine sets confidence to $0.50$ baseline with a note when token count is insufficient.
2. **Highly Technical or Legal Texts**:
   Legal statutes or regulatory filings written by humans may naturally exhibit high uniformity and low lexical variety, potentially triggering false-positive AI flags. Human review is required before publishing such determinations.
3. **Paraphrased / Hybrid Content**:
   Human journalists who edit LLM drafts or use automated grammar enhancement tools produce hybrid signals that cannot be definitively disentangled by statistical heuristics alone.

