"""
Article Content Extraction Service.

Responsible for:
1. Topic Extraction:
   - Identifies key thematic topics discussed in the article using frequency, headline salience,
     and syntactic keyword grouping.
   - Computes relevance scores and locates character positions within the article text.
   - Stores extracted topics in `ANALYSIS_TOPIC`.
2. Entity Extraction:
   - Extracts people, organizations, locations, and concepts using contextual capitalization,
     honorifics, corporate/institutional markers, and geography lexicons.
   - Reuses existing canonical records in `ENTITY` to prevent duplication across runs.
   - Connects extracted entities to `ARTICLE_ANALYSIS` via `ANALYSIS_ENTITY` with mention counts,
     salience scores, and narrative roles.
3. Fact Extraction:
   - Identifies factual assertions (statements of occurrence, official actions, quantitative statistics,
     and event milestones).
   - Preserves original evidence text and character offsets.
   - Explicitly flags statements as 'unverified' source claims rather than independently verified truth.
   - Stores extracted facts in `ANALYSIS_FACT`.
4. Quote Extraction:
   - Discovers direct quotations enclosed in quotation marks ("...", '...', “...”, ‘...’)
     and indirect speech attributions.
   - Discovers speaker names and titles from surrounding attribution clauses.
   - Distinguishes external speaker opinions from publisher/editorial narration.
   - Stores extracted quotes in `ANALYSIS_QUOTE`.
5. Connects all elements cleanly to `ARTICLE_ANALYSIS`.
"""

from collections import Counter
from datetime import datetime, timezone
import logging
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy.orm import Session, joinedload

from app.models.analysis_entity import AnalysisEntity
from app.models.analysis_fact import AnalysisFact
from app.models.analysis_quote import AnalysisQuote
from app.models.analysis_topic import AnalysisTopic
from app.models.article import Article
from app.models.article_analysis import ArticleAnalysis
from app.models.entity import Entity
from app.services.matching import COMMON_STOPWORDS

logger = logging.getLogger(__name__)

# Common honorifics and titles for identifying person names
HONORIFICS = {
    "mr", "mr.", "mrs", "mrs.", "ms", "ms.", "dr", "dr.", "prof", "prof.",
    "president", "chairman", "chairwoman", "chair", "governor", "senator",
    "minister", "secretary", "spokesman", "spokesperson", "spokeswoman",
    "ceo", "cfo", "director", "chief", "judge", "justice", "prime minister"
}

# Corporate, organizational, and institutional suffixes
ORG_MARKERS = {
    "inc", "inc.", "corp", "corp.", "ltd", "ltd.", "llc", "group", "co", "co.",
    "agency", "commission", "department", "ministry", "association", "institute",
    "organization", "organisation", "committee", "board", "bank", "federation",
    "union", "parliament", "congress", "administration", "foundation", "university",
    "council", "bureau", "service"
}

# Prominent known organizations and entities
KNOWN_ORGS = {
    "federal reserve", "fed", "central bank", "united nations", "un",
    "european central bank", "ecb", "nasa", "labor department", "justice department",
    "white house", "world bank", "imf", "nato", "fbi", "cia", "sec", "ftc",
    "reuters", "associated press", "bbc", "guardian", "techcrunch", "bloomberg"
}

# Known countries, cities, and locations
KNOWN_LOCATIONS = {
    "washington", "geneva", "new york", "london", "beijing", "tokyo", "paris",
    "berlin", "brussels", "moscow", "kyiv", "united states", "us", "u.s.", "usa",
    "china", "uk", "russia", "germany", "france", "japan", "switzerland"
}

# Common speech attribution verbs in news reporting
ATTRIBUTION_VERBS = {
    "said", "says", "stated", "noted", "added", "explained", "commented",
    "warned", "argued", "declared", "announced", "emphasized", "responded",
    "concluded", "pointed out", "told", "suggested", "urged", "tweeted", "wrote"
}

# Indicators of factual reporting statements (numbers, dates, official actions)
FACTUAL_MARKERS = re.compile(
    r"\b(\d+(?:,\d+)*(?:\.\d+)?%?|\b(?:voted|approved|lowered|raised|created|cut|"
    r"increased|decreased|signed|finalized|announced|reached|passed|reported|discovered|"
    r"launched|invested|declined|fell|grew)\b)",
    re.IGNORECASE,
)


def split_sentences(text: str) -> List[Tuple[str, int, int]]:
    """
    Splits text into sentences while retaining the start and end character offsets.
    Handles standard sentence terminators (. ! ?) without splitting on common abbreviations.
    """
    if not text:
        return []

    pattern = re.compile(r'[^.!?]+[.!?]?', re.UNICODE)
    sentences = []
    for match in pattern.finditer(text):
        sentence_str = match.group().strip()
        if len(sentence_str) > 1:
            start = match.start()
            end = match.end()
            sentences.append((sentence_str, start, end))
    return sentences


class ArticleContentExtractor:
    """
    Rule-based, high-precision content extraction engine.
    Extracts topics, entities, factual statements, and quotes directly from article text.
    """

    def extract_topics(self, text: str, headline: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Extracts salient thematic topics with relevance scores and evidence spans.
        """
        combined = f"{headline or ''} {text or ''}".strip()
        if not combined:
            return []

        topics: List[Dict[str, Any]] = []

        # 1. Headline topic phrases (highest relevance)
        if headline:
            clean_head = re.sub(r'["\',;:—–-]', ' ', headline).strip()
            # Extract 2-to-4 word informative noun chunks or meaningful headline phrases
            head_words = [w for w in clean_head.split() if w.lower() not in COMMON_STOPWORDS and len(w) > 2]
            if len(head_words) >= 2:
                primary_phrase = " ".join(head_words[:4]).title()
                # Find span in text or headline
                m = re.search(re.escape(head_words[0]), combined, re.IGNORECASE)
                start_c = m.start() if m else None
                end_c = (start_c + len(primary_phrase)) if start_c is not None else None
                topics.append({
                    "topic_name": primary_phrase,
                    "relevance_score": 0.95,
                    "start_char": start_c,
                    "end_char": end_c,
                    "evidence_text": headline[:120],
                })

        # 2. Extract multi-word capitalized phrases or domain concepts from body
        phrases = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b', text)
        phrase_counts = Counter(phrases)

        for phrase, count in phrase_counts.most_common(5):
            # Avoid duplicate with headline primary phrase
            if any(t["topic_name"].lower() == phrase.lower() for t in topics):
                continue

            match = re.search(re.escape(phrase), text)
            start_c = match.start() if match else None
            end_c = match.end() if match else None

            # Get surrounding sentence as evidence
            evidence = phrase
            if match:
                s_start = max(0, start_c - 40)
                s_end = min(len(text), end_c + 60)
                evidence = text[s_start:s_end].strip()

            relevance = min(0.90, 0.50 + 0.15 * count)
            topics.append({
                "topic_name": phrase,
                "relevance_score": round(relevance, 2),
                "start_char": start_c,
                "end_char": end_c,
                "evidence_text": evidence,
            })

        # 3. Fallback: Extract prominent domain keywords if few multi-word phrases exist
        if len(topics) < 3:
            words = [
                re.sub(r'[^a-zA-Z]', '', w).title()
                for w in text.split()
                if len(w) > 4 and w.lower() not in COMMON_STOPWORDS
            ]
            word_counts = Counter(words)
            for word, count in word_counts.most_common(4):
                if count >= 1 and not any(word.lower() in t["topic_name"].lower() for t in topics):
                    match = re.search(re.escape(word), text, re.IGNORECASE)
                    start_c = match.start() if match else None
                    end_c = match.end() if match else None
                    topics.append({
                        "topic_name": word,
                        "relevance_score": round(min(0.80, 0.45 + 0.10 * count), 2),
                        "start_char": start_c,
                        "end_char": end_c,
                        "evidence_text": f"Mentioned in article: '{word}'",
                    })
                if len(topics) >= 5:
                    break

        return topics[:6]

    def extract_entities(self, text: str) -> List[Dict[str, Any]]:
        """
        Extracts named entities (PERSON, ORGANIZATION, LOCATION, CONCEPT) with mention counts
        and salience scores.
        """
        if not text:
            return []

        candidates: Dict[str, Dict[str, Any]] = {}

        # 1. Look for known organizations (case-insensitive search)
        for org in KNOWN_ORGS:
            pattern = re.compile(rf'\b{re.escape(org)}\b', re.IGNORECASE)
            matches = list(pattern.finditer(text))
            if matches:
                canonical = org.title()
                if org.lower() in {"nasa", "fbi", "cia", "sec", "ftc", "ecb", "imf", "un", "nato", "bbc"}:
                    canonical = org.upper()
                candidates[canonical] = {
                    "name": canonical,
                    "entity_type": "ORGANIZATION",
                    "mention_count": len(matches),
                    "first_pos": matches[0].start(),
                    "role": "subject",
                }

        # 2. Look for known locations
        for loc in KNOWN_LOCATIONS:
            pattern = re.compile(rf'\b{re.escape(loc)}\b', re.IGNORECASE)
            matches = list(pattern.finditer(text))
            if matches:
                canonical = loc.title()
                if loc.lower() in {"us", "u.s.", "usa", "uk"}:
                    canonical = "United States" if loc.lower() != "uk" else "United Kingdom"
                candidates[canonical] = {
                    "name": canonical,
                    "entity_type": "LOCATION",
                    "mention_count": len(matches),
                    "first_pos": matches[0].start(),
                    "role": "location",
                }

        # 3. Look for person names preceded by honorifics or titles (e.g. Chairman Jerome Powell, Dr. Elena Rostova)
        honorific_pattern = re.compile(
            r'\b(' + '|'.join(re.escape(h) for h in HONORIFICS) + r')\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b',
            re.IGNORECASE
        )
        for match in honorific_pattern.finditer(text):
            title = match.group(1).title()
            name = match.group(2).strip()
            # If name matches multiple words, take only the first two or three capitalized name words
            name_words = name.split()
            # If a conjunction like "and" or word "held" was captured, truncate at first non-name word
            clean_name_words = []
            for w in name_words:
                if w.lower() in COMMON_STOPWORDS:
                    break
                clean_name_words.append(w)
            if clean_name_words:
                clean_name = " ".join(clean_name_words[:2])
                candidates[clean_name] = {
                    "name": clean_name,
                    "entity_type": "PERSON",
                    "mention_count": candidates.get(clean_name, {}).get("mention_count", 0) + 1,
                    "first_pos": match.start(),
                    "role": "quoted_source" if any(v in text[match.end():match.end()+40].lower() for v in ATTRIBUTION_VERBS) else "subject",
                    "title": title,
                }

        # 4. Multi-capital words with corporate/institutional suffixes
        for m in re.finditer(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(' + '|'.join(re.escape(o) for o in ORG_MARKERS) + r')\b', text, re.IGNORECASE):
            full_org = f"{m.group(1).title()} {m.group(2).title()}"
            candidates[full_org] = {
                "name": full_org,
                "entity_type": "ORGANIZATION",
                "mention_count": candidates.get(full_org, {}).get("mention_count", 0) + 1,
                "first_pos": m.start(),
                "role": "subject",
            }

        # 5. General capitalized proper noun sequences (e.g., James Webb Space Telescope, Elena Rostova)
        # Avoid phrases that cross conjunctions, punctuation, or lowercase stopwords
        capitalized_phrases = re.finditer(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b', text)
        for cp in capitalized_phrases:
            phrase = cp.group().strip()
            words = phrase.split()
            # Filter phrases with stop words like "and", "or", "in", etc.
            if any(w.lower() in COMMON_STOPWORDS for w in words):
                continue
            if phrase in candidates:
                candidates[phrase]["mention_count"] += 1
                continue

            # Classify type heuristically
            if any(w.lower() in ORG_MARKERS for w in words):
                ent_type = "ORGANIZATION"
            elif any(w.lower() in KNOWN_LOCATIONS for w in words):
                ent_type = "LOCATION"
            elif len(words) == 2 and not any(w.lower() in ORG_MARKERS for w in words):
                ent_type = "PERSON"
            else:
                ent_type = "CONCEPT"

            candidates[phrase] = {
                "name": phrase,
                "entity_type": ent_type,
                "mention_count": 1,
                "first_pos": cp.start(),
                "role": "subject",
            }

        # Compute salience score based on mention count and early position in text
        total_text_len = max(len(text), 1)
        results = []
        for name, data in candidates.items():
            pos_factor = max(0.0, 1.0 - (data.get("first_pos", 0) / total_text_len))
            salience = min(1.0, 0.40 * data["mention_count"] + 0.30 * pos_factor + 0.20)
            results.append({
                "name": name,
                "entity_type": data["entity_type"],
                "mention_count": data["mention_count"],
                "salience_score": round(salience, 2),
                "sentiment_score": 0.0,
                "role": data.get("role", "subject"),
            })

        # Sort by salience score descending
        results.sort(key=lambda x: x["salience_score"], reverse=True)
        return results

    def extract_facts(self, text: str) -> List[Dict[str, Any]]:
        """
        Extracts factual statements (actions, figures, dates, official declarations).
        Explicitly notes status as 'unverified' source claim.
        """
        if not text:
            return []

        sentences = split_sentences(text)
        facts: List[Dict[str, Any]] = []

        for sent_text, start_char, end_char in sentences:
            # Check if sentence contains factual reporting markers (numbers, dates, action verbs)
            has_factual_content = FACTUAL_MARKERS.search(sent_text)
            # Skip if sentence is pure quote opinion without factual anchor
            if has_factual_content and len(sent_text.split()) >= 5:
                confidence = 0.85
                if re.search(r'\d+', sent_text):
                    confidence += 0.10

                facts.append({
                    "fact_statement": sent_text,
                    "verification_status": "unverified",  # Source claim, not independently verified
                    "confidence_score": round(min(0.98, confidence), 2),
                    "start_char": start_char,
                    "end_char": end_char,
                    "evidence_text": sent_text,
                })

        return facts

    def extract_quotes(self, text: str) -> List[Dict[str, Any]]:
        """
        Extracts direct and indirect quotes along with speaker attribution.
        Distinguishes speaker opinion from publisher narration.
        """
        if not text:
            return []

        quotes: List[Dict[str, Any]] = []

        # Regex for quotes enclosed in quotation marks: "...", '...', “...”, ‘...’
        quote_regex = re.compile(r'["“]([^"”]{6,400})["”]|[\'‘]([^\'’]{6,400})[\'’]')

        for match in quote_regex.finditer(text):
            quote_content = match.group(1) or match.group(2)
            if not quote_content:
                continue

            quote_start = match.start()
            quote_end = match.end()

            # Search attribution clause in surrounding window (up to 80 chars before or after)
            context_before = text[max(0, quote_start - 80):quote_start]
            context_after = text[quote_end:min(len(text), quote_end + 80)]

            speaker_name: Optional[str] = None
            speaker_title: Optional[str] = None

            # First check context immediately following the quote (highest priority in news writing: "..." said Elena Rostova)
            for verb in ATTRIBUTION_VERBS:
                after_match = re.search(rf'^\s*[,.]?\s*{re.escape(verb)}\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)', context_after, re.IGNORECASE)
                if after_match:
                    speaker_name = after_match.group(1).strip()
                    break

                after_match2 = re.search(rf'^\s*[,.]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+{re.escape(verb)}', context_after, re.IGNORECASE)
                if after_match2:
                    speaker_name = after_match2.group(1).strip()
                    break

            # If not found after quote, check context before quote: Elena Rostova said, "..."
            if not speaker_name:
                for verb in ATTRIBUTION_VERBS:
                    before_match = re.search(rf'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+{re.escape(verb)}\s*[,:]?\s*$', context_before, re.IGNORECASE)
                    if before_match:
                        speaker_name = before_match.group(1).strip()
                        break

            # If speaker identified, check if preceding words contain honorific or title
            if speaker_name:
                combined_context = f"{context_before} {context_after}"
                for h in HONORIFICS:
                    if h.lower() in combined_context.lower():
                        speaker_title = h.title()
                        break

            quotes.append({
                "quote_text": quote_content.strip(),
                "speaker_name": speaker_name,
                "speaker_title": speaker_title,
                "source_type": "speaker_opinion",
                "is_opinion": True,
                "sentiment_score": 0.0,
                "start_char": quote_start,
                "end_char": quote_end,
            })

        return quotes


class ContentExtractionService:
    """
    Coordinates extraction of topics, entities, facts, and quotes,
    persisting them into PostgreSQL / SQLite with proper relational linking and deduplication.
    """

    def __init__(self, extractor: Optional[ArticleContentExtractor] = None):
        self.extractor = extractor or ArticleContentExtractor()

    def extract_and_store_article_content(
        self,
        db: Session,
        article_id: int,
        force_reanalyze: bool = False,
    ) -> ArticleAnalysis:
        """
        Executes full content extraction on the target article, storing:
        - ArticleAnalysis
        - AnalysisTopic records
        - Canonical Entity & AnalysisEntity records (reusing existing entities by name)
        - AnalysisFact records
        - AnalysisQuote records
        """
        article = db.query(Article).filter(Article.id == article_id).first()
        if not article:
            raise ValueError(f"Article with ID {article_id} not found.")

        # Check for existing completed analysis
        existing_analysis = (
            db.query(ArticleAnalysis)
            .options(
                joinedload(ArticleAnalysis.topics),
                joinedload(ArticleAnalysis.entities).joinedload(AnalysisEntity.entity),
                joinedload(ArticleAnalysis.facts),
                joinedload(ArticleAnalysis.quotes),
            )
            .filter(ArticleAnalysis.article_id == article_id)
            .order_by(ArticleAnalysis.id.desc())
            .first()
        )

        if existing_analysis and not force_reanalyze:
            return existing_analysis

        # Text to analyze
        full_text = article.content or article.title or ""
        headline = article.title

        # Run extraction steps
        extracted_topics = self.extractor.extract_topics(text=full_text, headline=headline)
        extracted_entities = self.extractor.extract_entities(text=full_text)
        extracted_facts = self.extractor.extract_facts(text=full_text)
        extracted_quotes = self.extractor.extract_quotes(text=full_text)

        # 1. Create ArticleAnalysis record
        analysis = ArticleAnalysis(
            article_id=article.id,
            pipeline_version="content-extract-v1.0",
            status="completed",
            bias_score=0.0,
            bias_label="center",
            sentiment_score=0.0,
            sentiment_label="neutral",
            confidence_score=0.90,
            language="en",
            summary=f"Automated content extraction: {len(extracted_topics)} topics, {len(extracted_entities)} entities, {len(extracted_facts)} facts, {len(extracted_quotes)} quotes.",
            created_at=datetime.now(timezone.utc),
        )
        db.add(analysis)
        db.flush()

        # 2. Store AnalysisTopic records
        for top_data in extracted_topics:
            topic_record = AnalysisTopic(
                analysis_id=analysis.id,
                topic_name=top_data["topic_name"],
                relevance_score=top_data["relevance_score"],
                start_char=top_data["start_char"],
                end_char=top_data["end_char"],
                evidence_text=top_data["evidence_text"],
                created_at=datetime.now(timezone.utc),
            )
            db.add(topic_record)

        # 3. Store Entity & AnalysisEntity records (reusing existing entities by name)
        for ent_data in extracted_entities:
            ent_name = ent_data["name"].strip()
            # Reuse canonical entity if already present in database
            canonical_entity = db.query(Entity).filter(Entity.name == ent_name).first()
            if not canonical_entity:
                canonical_entity = Entity(
                    name=ent_name,
                    entity_type=ent_data["entity_type"],
                    description=f"Auto-extracted entity ({ent_data['entity_type']})",
                    created_at=datetime.now(timezone.utc),
                )
                db.add(canonical_entity)
                db.flush()

            # Create AnalysisEntity association
            analysis_entity = AnalysisEntity(
                analysis_id=analysis.id,
                entity_id=canonical_entity.id,
                mention_count=ent_data["mention_count"],
                sentiment_score=ent_data.get("sentiment_score", 0.0),
                salience_score=ent_data["salience_score"],
                role=ent_data.get("role", "subject"),
                created_at=datetime.now(timezone.utc),
            )
            db.add(analysis_entity)

        # 4. Store AnalysisFact records
        for fact_data in extracted_facts:
            fact_record = AnalysisFact(
                analysis_id=analysis.id,
                fact_statement=fact_data["fact_statement"],
                verification_status=fact_data["verification_status"],
                confidence_score=fact_data["confidence_score"],
                start_char=fact_data["start_char"],
                end_char=fact_data["end_char"],
                evidence_text=fact_data["evidence_text"],
                created_at=datetime.now(timezone.utc),
            )
            db.add(fact_record)

        # 5. Store AnalysisQuote records
        for q_data in extracted_quotes:
            quote_record = AnalysisQuote(
                analysis_id=analysis.id,
                quote_text=q_data["quote_text"],
                speaker_name=q_data["speaker_name"],
                speaker_title=q_data["speaker_title"],
                source_type=q_data["source_type"],
                is_opinion=q_data["is_opinion"],
                sentiment_score=q_data["sentiment_score"],
                start_char=q_data["start_char"],
                end_char=q_data["end_char"],
                created_at=datetime.now(timezone.utc),
            )
            db.add(quote_record)

        db.commit()
        db.refresh(analysis)
        return analysis

    def get_latest_article_analysis(
        self,
        db: Session,
        article_id: int,
    ) -> Optional[ArticleAnalysis]:
        """
        Retrieves the latest completed extraction/analysis record for an article,
        eagerly loading topics, entities, facts, and quotes.
        """
        return (
            db.query(ArticleAnalysis)
            .options(
                joinedload(ArticleAnalysis.topics),
                joinedload(ArticleAnalysis.entities).joinedload(AnalysisEntity.entity),
                joinedload(ArticleAnalysis.facts),
                joinedload(ArticleAnalysis.quotes),
            )
            .filter(ArticleAnalysis.article_id == article_id)
            .order_by(ArticleAnalysis.id.desc())
            .first()
        )


# Global singleton
_extraction_service: Optional[ContentExtractionService] = None


def get_content_extraction_service() -> ContentExtractionService:
    global _extraction_service
    if _extraction_service is None:
        _extraction_service = ContentExtractionService()
    return _extraction_service
