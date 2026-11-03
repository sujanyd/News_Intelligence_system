"""
Article Matching and Pairwise Classification Service.

Responsible for:
1. Candidate retrieval via vector similarity search in Qdrant (excluding query article itself).
2. Multi-signal evidence extraction:
   - Headline embedding similarity.
   - Body embedding similarity (when content is available).
   - Named entity extraction & Jaccard overlap (names, organizations, locations, concepts).
   - Publication timestamp delta (recency alignment).
   - Event and story foreign key relationship alignment.
3. Classification decision logic:
   - SAME: Both articles report the same underlying event or occurrence.
   - RELATED: Both articles concern the same broader topic or connected development,
              but report different events, stages, or aspects.
   - DIFFERENT: The articles concern different underlying events or subjects;
                superficial semantic or topical similarity alone is insufficient.
4. Persistence in the PostgreSQL `ARTICLE_MATCH` table:
   - Enforces canonical ordering: article_id_1 < article_id_2.
   - Enforces unique constraint on (article_id_1, article_id_2) to prevent duplicate runs.
   - Calculates and stores similarity_score and confidence_score.
   - Keeps business logic modular and transparent.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
import logging
import math
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy.orm import Session, joinedload

from app.models.article import Article
from app.models.article_embedding import ArticleEmbedding
from app.models.article_match import ArticleMatch
from app.models.event import Event
from app.schemas.article_match import (
    ArticleMatchResponse,
    ArticleMatchSignalDetail,
    ArticleMatchSummaryResponse,
    MatchLabelType,
)
from app.services.embedding import (
    BaseEmbeddingProvider,
    get_embedding_provider,
    normalize_embedding_type,
)
from app.services.similarity import (
    SimilaritySearchService,
    get_similarity_service,
)
from app.services.text_preprocessing import (
    ProcessedArticleText,
    preprocess_article,
)
from app.services.vector_db import (
    VectorDatabaseService,
    VectorSearchResult,
    get_vector_db_service,
)

logger = logging.getLogger(__name__)

# Common English stopwords to ignore during entity candidate extraction
COMMON_STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
    "but", "by", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't",
    "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't",
    "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here",
    "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll",
    "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's",
    "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once",
    "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same",
    "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
    "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there",
    "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those",
    "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll",
    "we're", "we've", "were", "weren't", "what", "what's", "when", "when's", "where", "where's",
    "which", "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't",
    "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "january", "february", "march", "april", "may", "june", "july", "august", "september",
    "october", "november", "december", "today", "yesterday", "tomorrow", "reports", "reported",
    "says", "said", "new", "news", "breaking", "update", "latest",
}


def extract_salient_entities(text: str) -> Set[str]:
    """
    Extracts significant candidate entities (proper names, organizations, places, acronyms)
    from news text without requiring heavy external NLP models.

    Uses title-casing patterns, consecutive capitalized sequences (e.g. 'Federal Reserve', 'White House'),
    and uppercase acronyms (e.g. 'NASA', 'UN', 'FBI', 'ECB').
    """
    if not text:
        return set()

    entities: Set[str] = set()

    # 1. Multi-word proper noun phrases (e.g., "Federal Reserve", "United Nations", "Joe Biden")
    multi_word_pattern = re.compile(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b')
    for match in multi_word_pattern.finditer(text):
        phrase = match.group().strip()
        words = phrase.split()
        # Add full phrase
        if not all(w.lower() in COMMON_STOPWORDS for w in words):
            entities.add(phrase)
        # Also add adjacent 2-word sub-phrases (e.g., 'Federal Reserve', 'Jerome Powell')
        if len(words) > 2:
            for j in range(len(words) - 1):
                sub = f"{words[j]} {words[j+1]}"
                if not all(w.lower() in COMMON_STOPWORDS for w in sub.split()):
                    entities.add(sub)

    # 2. Acronyms (e.g., "NASA", "WHO", "IMF", "NATO", "EU")
    acronym_pattern = re.compile(r'\b[A-Z]{2,6}\b')
    for match in acronym_pattern.finditer(text):
        acronym = match.group().strip()
        if acronym.lower() not in COMMON_STOPWORDS:
            entities.add(acronym)

    # 3. Single capitalized proper nouns that are not starting a sentence
    single_word_pattern = re.compile(r'(?<=[a-z0-9,;]\s)[A-Z][a-z]{2,}\b')
    for match in single_word_pattern.finditer(text):
        word = match.group().strip()
        if word.lower() not in COMMON_STOPWORDS:
            entities.add(word)

    # Canonicalize to lower-case set for matching
    return {e.lower() for e in entities if len(e) >= 3}


def compute_entity_overlap(set_a: Set[str], set_b: Set[str]) -> Tuple[float, List[str]]:
    """
    Computes Jaccard similarity between two entity sets.
    Returns:
        (overlap_score between 0.0 and 1.0, list of shared entities)
    """
    if not set_a or not set_b:
        return 0.0, []

    intersection = set_a.intersection(set_b)
    union = set_a.union(set_b)

    score = len(intersection) / len(union) if union else 0.0
    shared = sorted(list(intersection))
    return round(score, 4), shared


def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """
    Computes standard cosine similarity between two numerical vectors.
    """
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0

    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))

    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0

    score = dot / (norm_a * norm_b)
    # Clamp to [-1.0, 1.0] to prevent floating point anomalies
    return max(-1.0, min(1.0, score))


@dataclass
class ClassificationSignals:
    """Diagnostic signals evaluated for a candidate article pair."""
    headline_similarity: Optional[float]
    body_similarity: Optional[float]
    entity_overlap_score: float
    shared_entities: List[str]
    time_diff_hours: Optional[float]
    event_id_match: bool
    same_story_id: bool


class ArticleMatchingService:
    """
    Core service that retrieves candidate pairs, computes multiple semantic & factual signals,
    classifies them into SAME / RELATED / DIFFERENT, and persists results in PostgreSQL.
    """

    def __init__(
        self,
        similarity_service: Optional[SimilaritySearchService] = None,
        vector_db: Optional[VectorDatabaseService] = None,
        embedding_provider: Optional[BaseEmbeddingProvider] = None,
    ):
        self._similarity_service = similarity_service
        self._vector_db = vector_db
        self._embedding_provider = embedding_provider

    @property
    def similarity_service(self) -> SimilaritySearchService:
        if self._similarity_service is None:
            return get_similarity_service()
        return self._similarity_service

    @property
    def vector_db(self) -> VectorDatabaseService:
        if self._vector_db is None:
            return get_vector_db_service()
        return self._vector_db

    @property
    def embedding_provider(self) -> BaseEmbeddingProvider:
        if self._embedding_provider is None:
            return get_embedding_provider()
        return self._embedding_provider

    def classify_article_pair(
        self,
        article_1: Article,
        article_2: Article,
        headline_sim: Optional[float] = None,
        body_sim: Optional[float] = None,
    ) -> Tuple[MatchLabelType, float, float, ClassificationSignals]:
        """
        Classifies an article pair into SAME, RELATED, or DIFFERENT using multi-signal heuristics.

        Returns:
            Tuple of:
            - match_label: 'SAME', 'RELATED', or 'DIFFERENT'
            - similarity_score: Combined similarity metric (0.0 to 1.0)
            - confidence_score: Confidence in the classification decision (0.0 to 1.0)
            - signals: ClassificationSignals diagnostic container
        """
        # 1. Headline & Body Embeddings extraction if not provided
        head_sim = headline_sim
        b_sim = body_sim

        # If headline similarity wasn't passed in, compute it via provider
        if head_sim is None:
            processed_1 = preprocess_article(article_1)
            processed_2 = preprocess_article(article_2)
            if processed_1.headline and processed_2.headline:
                vec_1 = self.embedding_provider.embed_text(processed_1.headline).vector
                vec_2 = self.embedding_provider.embed_text(processed_2.headline).vector
                head_sim = cosine_similarity(vec_1, vec_2)
            else:
                head_sim = 0.0

        # If body similarity is not provided, evaluate if both articles have content
        if b_sim is None:
            processed_1 = preprocess_article(article_1)
            processed_2 = preprocess_article(article_2)
            if processed_1.is_body_available and processed_2.is_body_available:
                vec_b1 = self.embedding_provider.embed_text(processed_1.body).vector
                vec_b2 = self.embedding_provider.embed_text(processed_2.body).vector
                b_sim = cosine_similarity(vec_b1, vec_b2)
            else:
                b_sim = None

        # 2. Extract salient entities and compute overlap
        text_1 = f"{article_1.title or ''} {article_1.content or ''}"
        text_2 = f"{article_2.title or ''} {article_2.content or ''}"
        entities_1 = extract_salient_entities(text_1)
        entities_2 = extract_salient_entities(text_2)
        entity_score, shared_entities = compute_entity_overlap(entities_1, entities_2)

        # 3. Publication time delta
        time_diff_hours: Optional[float] = None
        if article_1.published_at and article_2.published_at:
            delta = abs(article_1.published_at - article_2.published_at)
            time_diff_hours = round(delta.total_seconds() / 3600.0, 2)

        # 4. Relational Event/Story knowledge
        event_match = False
        story_match = False
        if article_1.event_id is not None and article_2.event_id is not None:
            if article_1.event_id == article_2.event_id:
                event_match = True
                story_match = True
            elif article_1.event and article_2.event and article_1.event.story_id == article_2.event.story_id:
                story_match = True

        signals = ClassificationSignals(
            headline_similarity=round(head_sim, 4) if head_sim is not None else None,
            body_similarity=round(b_sim, 4) if b_sim is not None else None,
            entity_overlap_score=entity_score,
            shared_entities=shared_entities,
            time_diff_hours=time_diff_hours,
            event_id_match=event_match,
            same_story_id=story_match,
        )

        # Combined composite similarity score (0.0 to 1.0)
        # Normalize head_sim from [-1, 1] to [0, 1]
        norm_head = max(0.0, (head_sim + 1.0) / 2.0) if head_sim is not None else 0.0
        norm_body = max(0.0, (b_sim + 1.0) / 2.0) if b_sim is not None else None

        if norm_body is not None:
            composite_similarity = 0.55 * norm_head + 0.30 * norm_body + 0.15 * entity_score
        else:
            composite_similarity = 0.75 * norm_head + 0.25 * entity_score

        composite_similarity = round(min(1.0, max(0.0, composite_similarity)), 4)

        # 5. Multi-Signal Decision Rules
        # Rule A: Ground-truth event match from relational schema
        if event_match:
            label: MatchLabelType = "SAME"
            confidence = 0.95
            return label, composite_similarity, confidence, signals

        # Publication recency penalty: events happening weeks apart are typically RELATED or DIFFERENT
        is_same_timeframe = time_diff_hours is None or time_diff_hours <= 96.0  # within 4 days

        # Rule B: Strong SAME evidence
        # High headline similarity (> 0.82) + significant shared entities (> 0.20 or >= 2 shared entities) + close timeframe
        has_strong_entity_evidence = entity_score >= 0.20 or len(shared_entities) >= 2
        if head_sim >= 0.82 and has_strong_entity_evidence and is_same_timeframe:
            label = "SAME"
            confidence = min(0.92, 0.65 + 0.25 * head_sim + 0.10 * entity_score)
            return label, composite_similarity, round(confidence, 4), signals

        # High body similarity + strong entity overlap even if headline phrasing differs across publishers
        if b_sim is not None and b_sim >= 0.80 and has_strong_entity_evidence and is_same_timeframe:
            label = "SAME"
            confidence = min(0.90, 0.60 + 0.25 * b_sim + 0.15 * entity_score)
            return label, composite_similarity, round(confidence, 4), signals

        # Rule C: RELATED evidence
        # Same overarching story or moderate similarity (headline > 0.50 or body > 0.55 or shared entities >= 1)
        if story_match or head_sim >= 0.52 or (b_sim is not None and b_sim >= 0.55) or entity_score >= 0.15 or len(shared_entities) >= 1:
            label = "RELATED"
            # Confidence in RELATED is higher when evidence firmly places them in the same domain
            confidence = min(0.85, 0.50 + 0.30 * norm_head + 0.20 * entity_score)
            return label, composite_similarity, round(confidence, 4), signals

        # Rule D: DIFFERENT
        label = "DIFFERENT"
        # Low similarity and no shared entities gives high confidence that articles are DIFFERENT
        confidence = min(0.95, 0.60 + 0.40 * (1.0 - composite_similarity))
        return label, composite_similarity, round(confidence, 4), signals

    def match_article_with_candidates(
        self,
        db: Session,
        article_id: int,
        candidate_limit: int = 10,
        score_threshold: Optional[float] = 0.2,
        force_reclassify: bool = False,
    ) -> ArticleMatchSummaryResponse:
        """
        Retrieves candidate articles for a given article via Qdrant,
        classifies each candidate pair as SAME, RELATED, or DIFFERENT,
        and saves the results in the `ARTICLE_MATCH` table.

        Strictly enforces canonical pair order (article_id_1 < article_id_2).
        """
        # 1. Fetch query article
        target_article = (
            db.query(Article)
            .options(joinedload(Article.source), joinedload(Article.event))
            .filter(Article.id == article_id)
            .first()
        )
        if not target_article:
            raise ValueError(f"Article with ID {article_id} does not exist.")

        # 2. Retrieve candidates from vector database using existing similarity service
        # Query article itself is automatically excluded by similarity search
        candidates_response = self.similarity_service.find_similar_by_article_id(
            db=db,
            article_id=article_id,
            embedding_type="headline",
            limit=candidate_limit,
            score_threshold=score_threshold,
        )

        candidates = candidates_response.matches
        created_count = 0
        updated_count = 0
        skipped_count = 0
        match_responses: List[ArticleMatchResponse] = []

        if not candidates:
            return ArticleMatchSummaryResponse(
                query_article_id=article_id,
                query_title=target_article.title,
                candidates_retrieved=0,
                matches_created=0,
                matches_updated=0,
                matches_skipped=0,
                matches=[],
            )

        # Cache candidate Article ORM models
        candidate_ids = [c.article_id for c in candidates]
        candidate_articles = (
            db.query(Article)
            .options(joinedload(Article.source), joinedload(Article.event))
            .filter(Article.id.in_(candidate_ids))
            .all()
        )
        cand_map = {a.id: a for a in candidate_articles}

        # 3. Process each candidate
        for cand_match in candidates:
            cand_article = cand_map.get(cand_match.article_id)
            if not cand_article:
                continue

            # Defensive self-matching check
            if cand_article.id == target_article.id:
                continue

            # Enforce canonical ordering: article_id_1 < article_id_2
            id_1, id_2 = (
                (target_article.id, cand_article.id)
                if target_article.id < cand_article.id
                else (cand_article.id, target_article.id)
            )
            art_1, art_2 = (
                (target_article, cand_article)
                if target_article.id < cand_article.id
                else (cand_article, target_article)
            )

            # Check existing match record
            existing_match = (
                db.query(ArticleMatch)
                .filter(
                    ArticleMatch.article_id_1 == id_1,
                    ArticleMatch.article_id_2 == id_2,
                )
                .first()
            )

            if existing_match and not force_reclassify:
                skipped_count += 1
                match_responses.append(
                    ArticleMatchResponse(
                        id=existing_match.id,
                        article_id_1=existing_match.article_id_1,
                        article_id_2=existing_match.article_id_2,
                        match_label=existing_match.match_label,
                        similarity_score=existing_match.similarity_score,
                        confidence_score=existing_match.confidence_score,
                        model_name=existing_match.model_name,
                        created_at=existing_match.created_at,
                        article_1_title=art_1.title,
                        article_2_title=art_2.title,
                        article_1_source=art_1.source.name if art_1.source else None,
                        article_2_source=art_2.source.name if art_2.source else None,
                    )
                )
                continue

            # Classify candidate pair using multi-signal heuristics
            label, sim_score, conf_score, sigs = self.classify_article_pair(
                article_1=art_1,
                article_2=art_2,
                headline_sim=cand_match.similarity_score,
            )

            model_identifier = "multi_signal_classifier_v1"

            if existing_match and force_reclassify:
                existing_match.match_label = label
                existing_match.similarity_score = sim_score
                existing_match.confidence_score = conf_score
                existing_match.model_name = model_identifier
                db.flush()
                target_record = existing_match
                updated_count += 1
            else:
                new_match = ArticleMatch(
                    article_id_1=id_1,
                    article_id_2=id_2,
                    match_label=label,
                    similarity_score=sim_score,
                    confidence_score=conf_score,
                    model_name=model_identifier,
                )
                db.add(new_match)
                db.flush()
                target_record = new_match
                created_count += 1

            sig_detail = ArticleMatchSignalDetail(
                headline_similarity=sigs.headline_similarity,
                body_similarity=sigs.body_similarity,
                entity_overlap_score=sigs.entity_overlap_score,
                shared_entities=sigs.shared_entities,
                publication_time_diff_hours=sigs.time_diff_hours,
                event_id_match=sigs.event_id_match,
                same_story_id=sigs.same_story_id,
                classification_method=model_identifier,
            )

            match_responses.append(
                ArticleMatchResponse(
                    id=target_record.id,
                    article_id_1=target_record.article_id_1,
                    article_id_2=target_record.article_id_2,
                    match_label=target_record.match_label,
                    similarity_score=target_record.similarity_score,
                    confidence_score=target_record.confidence_score,
                    model_name=target_record.model_name,
                    created_at=target_record.created_at,
                    article_1_title=art_1.title,
                    article_2_title=art_2.title,
                    article_1_source=art_1.source.name if art_1.source else None,
                    article_2_source=art_2.source.name if art_2.source else None,
                    signals=sig_detail,
                )
            )

        db.commit()

        return ArticleMatchSummaryResponse(
            query_article_id=article_id,
            query_title=target_article.title,
            candidates_retrieved=len(candidates),
            matches_created=created_count,
            matches_updated=updated_count,
            matches_skipped=skipped_count,
            matches=match_responses,
        )

    def get_matches_for_article(
        self,
        db: Session,
        article_id: int,
        label: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[ArticleMatchResponse]:
        """
        Retrieves all match records involving a given article (as either article_1 or article_2).
        """
        # Verify article exists
        exists = db.query(Article.id).filter(Article.id == article_id).scalar()
        if not exists:
            raise ValueError(f"Article with ID {article_id} does not exist.")

        query = (
            db.query(ArticleMatch)
            .options(
                joinedload(ArticleMatch.article_1).joinedload(Article.source),
                joinedload(ArticleMatch.article_2).joinedload(Article.source),
            )
            .filter(
                (ArticleMatch.article_id_1 == article_id) | (ArticleMatch.article_id_2 == article_id)
            )
        )

        if label:
            query = query.filter(ArticleMatch.match_label == label.upper())

        matches = query.order_by(ArticleMatch.similarity_score.desc().nullslast()).offset(offset).limit(limit).all()

        results: List[ArticleMatchResponse] = []
        for m in matches:
            results.append(
                ArticleMatchResponse(
                    id=m.id,
                    article_id_1=m.article_id_1,
                    article_id_2=m.article_id_2,
                    match_label=m.match_label,
                    similarity_score=m.similarity_score,
                    confidence_score=m.confidence_score,
                    model_name=m.model_name,
                    created_at=m.created_at,
                    article_1_title=m.article_1.title if m.article_1 else None,
                    article_2_title=m.article_2.title if m.article_2 else None,
                    article_1_source=m.article_1.source.name if m.article_1 and m.article_1.source else None,
                    article_2_source=m.article_2.source.name if m.article_2 and m.article_2.source else None,
                )
            )

        return results

    def get_match_by_id(
        self,
        db: Session,
        match_id: int,
    ) -> Optional[ArticleMatchResponse]:
        """
        Retrieves a single ArticleMatch by its primary key ID.
        """
        match = (
            db.query(ArticleMatch)
            .options(
                joinedload(ArticleMatch.article_1).joinedload(Article.source),
                joinedload(ArticleMatch.article_2).joinedload(Article.source),
            )
            .filter(ArticleMatch.id == match_id)
            .first()
        )

        if not match:
            return None

        return ArticleMatchResponse(
            id=match.id,
            article_id_1=match.article_id_1,
            article_id_2=match.article_id_2,
            match_label=match.match_label,
            similarity_score=match.similarity_score,
            confidence_score=match.confidence_score,
            model_name=match.model_name,
            created_at=match.created_at,
            article_1_title=match.article_1.title if match.article_1 else None,
            article_2_title=match.article_2.title if match.article_2 else None,
            article_1_source=match.article_1.source.name if match.article_1 and match.article_1.source else None,
            article_2_source=match.article_2.source.name if match.article_2 and match.article_2.source else None,
        )


# Global singleton provider
_matching_service: Optional[ArticleMatchingService] = None


def get_matching_service() -> ArticleMatchingService:
    global _matching_service
    if _matching_service is None:
        _matching_service = ArticleMatchingService()
    return _matching_service
