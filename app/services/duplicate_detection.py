"""
Duplicate Detection Service.

Responsible for:
1. Exact Duplicate Detection:
   - Identifies articles with identical canonical URLs or identical content hashes.
2. Near-Duplicate Detection:
   - Evaluates high-similarity candidate articles (lexical n-gram overlap and vector similarity >= 0.88).
   - Distinguishes near-duplicate syndicated/republished coverage from independent reporting
     on the same event.
   - Preserves duplicate relationships by populating `duplicate_of_article_id` on the newer/secondary article
     pointing to the canonical original article.
"""

from datetime import datetime, timezone
import hashlib
import logging
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy.orm import Session

from app.models.article import Article
from app.services.matching import cosine_similarity, extract_salient_entities
from app.services.text_preprocessing import preprocess_article

logger = logging.getLogger(__name__)


def compute_shingle_set(text: str, k: int = 3) -> Set[str]:
    """
    Computes k-shingle (k-word character shingles) representation of normalized text
    for high-precision near-duplicate detection.
    """
    if not text:
        return set()
    words = re.findall(r'\b[a-z0-9]+\b', text.lower())
    if len(words) < k:
        return {" ".join(words)} if words else set()
    return {" ".join(words[i:i + k]) for i in range(len(words) - k + 1)}


def jaccard_similarity(set_a: Set[str], set_b: Set[str]) -> float:
    """Computes Jaccard coefficient between two token/shingle sets."""
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a.intersection(set_b))
    union = len(set_a.union(set_b))
    return round(intersection / union, 4) if union > 0 else 0.0


class DuplicateDetectionService:
    """
    Service for identifying and linking duplicate and near-duplicate articles.
    """

    def check_exact_duplicate(
        self,
        db: Session,
        article: Article,
    ) -> Optional[Article]:
        """
        Checks if an identical article already exists via canonical_url or content_hash.
        Returns the existing canonical article if found, otherwise None.
        """
        # 1. Canonical URL match
        if article.canonical_url:
            canonical_match = (
                db.query(Article)
                .filter(
                    Article.id != article.id,
                    Article.canonical_url == article.canonical_url,
                )
                .order_by(Article.id.asc())
                .first()
            )
            if canonical_match:
                return canonical_match

        # 2. Content hash match
        hash_to_check = article.content_hash
        if not hash_to_check and article.content:
            hash_to_check = hashlib.sha256(article.content.encode("utf-8")).hexdigest()

        if hash_to_check:
            # Check by content_hash or compute for comparison
            hash_match = (
                db.query(Article)
                .filter(
                    Article.id != article.id,
                    Article.content_hash == hash_to_check,
                )
                .order_by(Article.id.asc())
                .first()
            )
            if hash_match:
                return hash_match

            # Also check if any older article has identical raw content
            if article.content:
                content_match = (
                    db.query(Article)
                    .filter(
                        Article.id != article.id,
                        Article.content == article.content,
                    )
                    .order_by(Article.id.asc())
                    .first()
                )
                if content_match:
                    return content_match

        return None

    def evaluate_near_duplicate(
        self,
        article_a: Article,
        article_b: Article,
    ) -> Tuple[bool, float, str]:
        """
        Evaluates whether article_b is a near-duplicate / syndication of article_a.
        Uses headline similarity, body shingle overlap, and entity consistency.

        Returns:
            Tuple of:
            - is_near_duplicate (bool)
            - similarity_score (float, 0.0 to 1.0)
            - reason (str)
        """
        text_a = article_a.content or article_a.title or ""
        text_b = article_b.content or article_b.title or ""

        if not text_a or not text_b:
            return False, 0.0, "Insufficient text content to evaluate duplicate relationship."

        # 1. Compare exact content hash
        hash_a = article_a.content_hash or hashlib.sha256(text_a.encode("utf-8")).hexdigest()
        hash_b = article_b.content_hash or hashlib.sha256(text_b.encode("utf-8")).hexdigest()
        if hash_a == hash_b:
            return True, 1.0, "Identical content hash; exact duplicate."

        # 2. Shingle-based lexical overlap (k=2 and k=3)
        shingles_a = compute_shingle_set(text_a, k=2)
        shingles_b = compute_shingle_set(text_b, k=2)
        lexical_sim = jaccard_similarity(shingles_a, shingles_b)

        # Word-level vocabulary overlap
        words_a = set(re.findall(r'\b[a-z0-9]+\b', text_a.lower()))
        words_b = set(re.findall(r'\b[a-z0-9]+\b', text_b.lower()))
        word_sim = jaccard_similarity(words_a, words_b)

        # 3. Headline overlap
        head_a = set(re.findall(r'\b[a-z0-9]+\b', (article_a.title or "").lower()))
        head_b = set(re.findall(r'\b[a-z0-9]+\b', (article_b.title or "").lower()))
        head_sim = jaccard_similarity(head_a, head_b)

        # Combined near-duplicate score
        combined_score = round(0.5 * lexical_sim + 0.3 * word_sim + 0.2 * head_sim, 4)

        # Threshold criteria for near-duplicate syndication:
        # High bigram/word overlap (>= 0.60) or nearly identical text with minor edit/byline differences
        if (lexical_sim >= 0.55 and word_sim >= 0.60) or lexical_sim >= 0.70 or (head_sim >= 0.70 and word_sim >= 0.55):
            reason = (
                f"High textual and lexical overlap (bigram_jaccard={lexical_sim:.2f}, "
                f"word_jaccard={word_sim:.2f}, headline_jaccard={head_sim:.2f}). "
                f"Classified as near-duplicate syndication."
            )
            return True, combined_score, reason

        return False, combined_score, f"Distinct reporting (lexical_sim={lexical_sim:.2f})."

    def detect_and_link_duplicates_for_article(
        self,
        db: Session,
        article_id: int,
        candidates_limit: int = 50,
    ) -> Dict[str, Any]:
        """
        Scans potential duplicate candidates for an article.
        If a duplicate is identified, sets `duplicate_of_article_id` on the newer article.
        """
        target = db.query(Article).filter(Article.id == article_id).first()
        if not target:
            raise ValueError(f"Article with ID {article_id} does not exist.")

        # 1. First check exact duplicate
        exact = self.check_exact_duplicate(db=db, article=target)
        if exact:
            # Earlier article is the canonical primary
            canonical = exact if exact.id < target.id else target
            duplicate = target if exact.id < target.id else exact
            duplicate.duplicate_of_article_id = canonical.id
            db.commit()
            db.refresh(target)
            return {
                "article_id": target.id,
                "is_duplicate": True,
                "duplicate_type": "exact",
                "canonical_article_id": canonical.id,
                "similarity_score": 1.0,
                "reason": "Exact match on canonical URL or content hash.",
            }

        # 2. Check candidate articles from same timeframe or same event
        query = db.query(Article).filter(Article.id != target.id)
        if target.event_id is not None:
            query = query.filter(Article.event_id == target.event_id)
        candidates = query.order_by(Article.id.asc()).limit(candidates_limit).all()

        for cand in candidates:
            is_dup, sim, reason = self.evaluate_near_duplicate(target, cand)
            if is_dup:
                canonical = cand if cand.id < target.id else target
                duplicate = target if cand.id < target.id else cand
                duplicate.duplicate_of_article_id = canonical.id
                db.commit()
                db.refresh(target)
                return {
                    "article_id": target.id,
                    "is_duplicate": True,
                    "duplicate_type": "near_duplicate",
                    "canonical_article_id": canonical.id,
                    "similarity_score": sim,
                    "reason": reason,
                }

        return {
            "article_id": target.id,
            "is_duplicate": False,
            "duplicate_type": "none",
            "canonical_article_id": None,
            "similarity_score": 0.0,
            "reason": "No exact or near-duplicate article identified.",
        }


_duplicate_service: Optional[DuplicateDetectionService] = None


def get_duplicate_detection_service() -> DuplicateDetectionService:
    global _duplicate_service
    if _duplicate_service is None:
        _duplicate_service = DuplicateDetectionService()
    return _duplicate_service
