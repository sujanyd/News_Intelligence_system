"""
AI-Generated News Text Detection Service.

Responsible for:
1. Probabilistic estimation of machine-generated text (0.0 to 1.0).
2. Evaluation of empirical statistical metrics:
   - Burstiness: Variance in sentence length and complexity (LLMs typically exhibit more uniform sentence pacing).
   - Lexical Uniformity: Type-token ratios and vocabulary entropy across segments.
   - N-gram Repetition & Transition Predictability.
3. Persistence in `AI_DETECTION_RESULT` (`ai_detection_results`).
4. Human editorial review flagging (`is_flagged_for_review`).
5. Critical Ethical Guidance:
   - AI detection is inherently uncertain and heuristic.
   - Results are strictly analytical estimates, NOT definitive proof of AI generation.
   - High likelihood scores must not be presented as established fact.
"""

from datetime import datetime, timezone
import json
import logging
import math
import re
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.ai_detection_result import AIDetectionResult
from app.models.article import Article
from app.schemas.ai_detection import (
    AIDetectionMetricDetails,
    AIDetectionResponse,
)
from app.services.content_extraction import split_sentences

logger = logging.getLogger(__name__)

DETECTOR_MODEL_NAME = "statistical-burstiness-entropy-v1"
DETECTOR_MODEL_VERSION = "1.0.0"

LIMITATIONS_DISCLAIMER = (
    "AI detection estimates are statistical approximations based on sentence pacing and vocabulary entropy. "
    "They do NOT provide definitive proof of machine generation. Human technical writing, legal journalism, "
    "or formulaic wire copy can naturally produce elevated similarity scores."
)


class AIDetectionEngine:
    """
    Statistical heuristic engine evaluating machine-generated text characteristics.
    """

    def analyze_text(self, text: str) -> Dict[str, Any]:
        """
        Calculates burstiness, lexical uniformity, and sentence variance to compute
        an estimated AI likelihood score (0.0 to 1.0) and confidence score.
        """
        if not text or len(text.strip()) < 50:
            return {
                "ai_likelihood": 0.05,
                "confidence_score": 0.50,
                "metrics": {
                    "burstiness_score": 0.50,
                    "lexical_uniformity": 0.50,
                    "sentence_count": 0,
                    "average_sentence_length": 0.0,
                    "repetition_index": 0.0,
                    "methodology": "Insufficient text content for high-confidence statistical evaluation.",
                },
                "interpretation": "Insufficient text content; baseline human presumption applied.",
            }

        sentences = split_sentences(text)
        sentence_lengths = [len(re.findall(r'\b\w+\b', s[0])) for s in sentences if len(s[0].strip()) > 3]

        if not sentence_lengths:
            sentence_lengths = [len(text.split())]

        n_sentences = len(sentence_lengths)
        avg_len = sum(sentence_lengths) / n_sentences

        # 1. Burstiness (Variance of sentence lengths)
        # Human writing has high variance (mix of short punchy sentences and long complex ones).
        # LLMs often produce consistent medium-length sentences (low variance).
        if n_sentences > 1:
            variance = sum((l - avg_len) ** 2 for l in sentence_lengths) / (n_sentences - 1)
            std_dev = math.sqrt(variance)
            # Normalized coefficient of variation (0.0 to 1.0)
            cv = std_dev / avg_len if avg_len > 0 else 0.0
            # Higher CV = higher burstiness (more human). Lower CV = lower burstiness (more AI-like).
            burstiness = round(min(1.0, cv), 3)
        else:
            burstiness = 0.5

        # 2. Lexical Diversity & Uniformity (Type-Token Ratio)
        words = re.findall(r'\b[a-z]{2,}\b', text.lower())
        total_tokens = len(words)
        unique_tokens = len(set(words))
        ttr = unique_tokens / total_tokens if total_tokens > 0 else 1.0

        # Lexical uniformity: high TTR with very balanced distributions can indicate synthetic prose
        lexical_uniformity = round(1.0 - ttr, 3)

        # 3. Bigram Repetition Index
        bigrams = [f"{words[i]}_{words[i+1]}" for i in range(len(words) - 1)] if len(words) > 1 else []
        unique_bigrams = len(set(bigrams))
        bigram_ratio = unique_bigrams / len(bigrams) if bigrams else 1.0
        repetition_index = round(1.0 - bigram_ratio, 3)

        # 4. Synthesize Likelihood Estimate
        # Low burstiness (<= 0.30) and very uniform sentence pacing increases likelihood
        # High burstiness (>= 0.65) strongly indicates human authoring
        burstiness_factor = max(0.0, 1.0 - burstiness)
        raw_score = 0.65 * burstiness_factor + 0.25 * lexical_uniformity + 0.10 * (1.0 - abs(0.5 - ttr))

        # Clamp score between 0.02 and 0.95 (never 0.0 or 1.0 to reflect scientific uncertainty)
        ai_likelihood = round(max(0.02, min(0.95, raw_score)), 2)

        # Confidence based on document length
        if total_tokens > 300:
            confidence = 0.88
        elif total_tokens > 100:
            confidence = 0.78
        else:
            confidence = 0.65

        # Qualitative Interpretation
        if ai_likelihood >= 0.75:
            interpretation = (
                f"Elevated probability ({ai_likelihood:.0%}) of synthetic or machine-assisted text. "
                f"Text exhibits low sentence length variation (burstiness: {burstiness:.2f}) and uniform syntactic pacing."
            )
        elif ai_likelihood >= 0.50:
            interpretation = (
                f"Moderate probability ({ai_likelihood:.0%}) of machine-assisted phrasing or highly formulaic prose. "
                f"Text displays mixed pacing indicators."
            )
        elif ai_likelihood >= 0.25:
            interpretation = (
                f"Low probability ({ai_likelihood:.0%}) of AI generation. "
                f"Pacing and lexical diversity are consistent with standard human journalistic writing."
            )
        else:
            interpretation = (
                f"Negligible probability ({ai_likelihood:.0%}) of AI generation. "
                f"Text displays high burstiness ({burstiness:.2f}) and varied syntactic structure characteristic of human journalism."
            )

        metrics = {
            "burstiness_score": burstiness,
            "lexical_uniformity": lexical_uniformity,
            "sentence_count": n_sentences,
            "average_sentence_length": round(avg_len, 1),
            "repetition_index": repetition_index,
            "methodology": "Statistical analysis of sentence pacing variance (burstiness) and vocabulary entropy.",
        }

        return {
            "ai_likelihood": ai_likelihood,
            "confidence_score": confidence,
            "metrics": metrics,
            "interpretation": interpretation,
        }


class AIDetectionService:
    """
    Coordinates AI text detection, database persistence, and review flagging.
    """

    def __init__(self):
        self.engine = AIDetectionEngine()

    def analyze_and_store_article(
        self,
        db: Session,
        article_id: int,
        force_reanalyze: bool = False,
        flag_threshold: float = 0.75,
    ) -> AIDetectionResponse:
        """
        Evaluates an article for machine-generated text characteristics,
        records results in `ai_detection_results`, and returns structured response.
        """
        article = db.query(Article).filter(Article.id == article_id).first()
        if not article:
            raise ValueError(f"Article with ID {article_id} does not exist.")

        # Check existing result
        existing = (
            db.query(AIDetectionResult)
            .filter(AIDetectionResult.article_id == article_id)
            .order_by(AIDetectionResult.id.desc())
            .first()
        )

        if existing and not force_reanalyze:
            return self._build_response(existing)

        # Run analysis
        text_to_eval = f"{article.title or ''}\n\n{article.content or ''}"
        res = self.engine.analyze_text(text_to_eval)

        is_flagged = res["ai_likelihood"] >= flag_threshold
        details_json = json.dumps(res["metrics"])

        if existing and force_reanalyze:
            existing.ai_likelihood = res["ai_likelihood"]
            existing.confidence_score = res["confidence_score"]
            existing.model_name = DETECTOR_MODEL_NAME
            existing.model_version = DETECTOR_MODEL_VERSION
            existing.analysis_details = details_json
            existing.is_flagged_for_review = is_flagged
            db_record = existing
        else:
            db_record = AIDetectionResult(
                article_id=article.id,
                ai_likelihood=res["ai_likelihood"],
                confidence_score=res["confidence_score"],
                model_name=DETECTOR_MODEL_NAME,
                model_version=DETECTOR_MODEL_VERSION,
                analysis_details=details_json,
                is_flagged_for_review=is_flagged,
                created_at=datetime.now(timezone.utc),
            )
            db.add(db_record)

        db.commit()
        db.refresh(db_record)

        return self._build_response(db_record, parsed_metrics=res["metrics"], interpretation=res["interpretation"])

    def get_article_ai_detection(
        self,
        db: Session,
        article_id: int,
    ) -> AIDetectionResponse:
        """
        Retrieves existing AI detection result, or automatically executes detection if not yet evaluated.
        """
        existing = (
            db.query(AIDetectionResult)
            .filter(AIDetectionResult.article_id == article_id)
            .order_by(AIDetectionResult.id.desc())
            .first()
        )
        if existing:
            return self._build_response(existing)

        # If not yet evaluated, run analysis
        return self.analyze_and_store_article(db=db, article_id=article_id, force_reanalyze=False)

    def list_flagged_articles(
        self,
        db: Session,
        limit: int = 50,
        offset: int = 0,
    ) -> List[AIDetectionResponse]:
        """
        Lists articles flagged for human editorial verification.
        """
        rows = (
            db.query(AIDetectionResult)
            .filter(AIDetectionResult.is_flagged_for_review == True)
            .order_by(AIDetectionResult.ai_likelihood.desc(), AIDetectionResult.id.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return [self._build_response(r) for r in rows]

    def _build_response(
        self,
        record: AIDetectionResult,
        parsed_metrics: Optional[Dict[str, Any]] = None,
        interpretation: Optional[str] = None,
    ) -> AIDetectionResponse:
        metrics_dict = parsed_metrics
        if not metrics_dict and record.analysis_details:
            try:
                metrics_dict = json.loads(record.analysis_details)
            except Exception:
                metrics_dict = None

        metric_details = None
        if metrics_dict:
            metric_details = AIDetectionMetricDetails(
                burstiness_score=metrics_dict.get("burstiness_score", 0.5),
                lexical_uniformity=metrics_dict.get("lexical_uniformity", 0.5),
                sentence_count=metrics_dict.get("sentence_count", 0),
                average_sentence_length=metrics_dict.get("average_sentence_length", 0.0),
                repetition_index=metrics_dict.get("repetition_index", 0.0),
                methodology=metrics_dict.get("methodology", "Statistical burstiness and pacing entropy."),
            )

        if not interpretation:
            score = record.ai_likelihood
            if score >= 0.75:
                interpretation = f"Elevated probability ({score:.0%}) of synthetic or machine-assisted text."
            elif score >= 0.50:
                interpretation = f"Moderate probability ({score:.0%}) of machine-assisted phrasing."
            else:
                interpretation = f"Low probability ({score:.0%}) of AI generation; consistent with human journalism."

        return AIDetectionResponse(
            id=record.id,
            article_id=record.article_id,
            ai_likelihood=record.ai_likelihood,
            confidence_score=record.confidence_score,
            model_name=record.model_name,
            model_version=record.model_version,
            is_flagged_for_review=record.is_flagged_for_review,
            analysis_details=record.analysis_details,
            metrics=metric_details,
            interpretation=interpretation,
            limitations=LIMITATIONS_DISCLAIMER,
            created_at=record.created_at,
        )


_ai_detection_service: Optional[AIDetectionService] = None


def get_ai_detection_service() -> AIDetectionService:
    global _ai_detection_service
    if _ai_detection_service is None:
        _ai_detection_service = AIDetectionService()
    return _ai_detection_service
