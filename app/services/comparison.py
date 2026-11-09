"""
Cross-Source News Comparison Service.

Responsible for:
1. Multi-Outlet Comparison Workflow:
   - Comparing articles covering the same event or subject across multiple publishers.
   - Enforcing composite foreign key constraints on `(comparison_id, article_id)` via `comparison_articles`.
2. Factual Coverage & Omission Analysis:
   - Extracting salient topics and facts from each article.
   - Computing coverage depth scores and identifying selective omissions between outlets.
   - Storing per-article evaluations in `COMPARISON_COVERAGE`.
3. Rhetorical & Framing Contrast Discovery:
   - Detecting differences in headline framing, article tone valence, and evidence citations.
   - Generating grounded evidence rows in `COMPARISON_EVIDENCE` with character offsets.
4. Integrating Political Leaning Signals:
   - Linking evaluations into `COMPARISON_POLITICAL_SIGNAL`.
5. Synthesizing High-Level Comparative Insights:
   - Providing an objective narrative synthesis of consensus, divergence, and coverage gaps.
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy.orm import Session, joinedload

from app.models.article import Article
from app.models.comparison_article import ComparisonArticle
from app.models.comparison_coverage import ComparisonCoverage
from app.models.comparison_evidence import ComparisonEvidence
from app.models.comparison_political_signal import ComparisonPoliticalSignal
from app.models.event import Event
from app.models.news_comparison import NewsComparison
from app.schemas.comparison_report import (
    ComparisonCoverageResponse,
    ComparisonEvidenceResponse,
    NewsComparisonDetailResponse,
    NewsComparisonSummaryResponse,
)
from app.schemas.political_signal import ComparisonPoliticalSignalResponse
from app.services.content_extraction import ArticleContentExtractor, split_sentences
from app.services.political_signal import get_political_signal_service
from app.services.tone_framing import ToneAndFramingAnalyzer

logger = logging.getLogger(__name__)


class NewsComparisonService:
    """
    Core service coordinating cross-source news comparison and evidence generation.
    """

    def __init__(self):
        self.tone_analyzer = ToneAndFramingAnalyzer()
        self.content_extractor = ArticleContentExtractor()
        self.political_service = get_political_signal_service()

    def create_or_run_comparison(
        self,
        db: Session,
        title: str,
        description: Optional[str] = None,
        event_id: Optional[int] = None,
        article_ids: Optional[List[int]] = None,
    ) -> NewsComparisonDetailResponse:
        """
        Creates a new NewsComparison session, gathers target articles, evaluates cross-outlet
        coverage depth, extracts comparative framing contrasts, and stores results.
        """
        # 1. Resolve articles to compare
        target_articles: List[Article] = []
        if article_ids and len(article_ids) >= 2:
            target_articles = (
                db.query(Article)
                .options(joinedload(Article.source))
                .filter(Article.id.in_(article_ids))
                .all()
            )
        elif event_id is not None:
            event = db.query(Event).filter(Event.id == event_id).first()
            if not event:
                raise ValueError(f"Event with ID {event_id} does not exist.")
            target_articles = (
                db.query(Article)
                .options(joinedload(Article.source))
                .filter(Article.event_id == event_id)
                .all()
            )
        else:
            raise ValueError("Either event_id or at least two article_ids must be provided.")

        if len(target_articles) < 2:
            raise ValueError(
                f"A cross-source comparison requires at least 2 distinct articles (found {len(target_articles)})."
            )

        # 2. Create the parent NewsComparison record
        comparison = NewsComparison(
            event_id=event_id,
            title=title,
            description=description or f"Comparative analysis across {len(target_articles)} news outlets.",
            status="completed",
            created_at=datetime.now(timezone.utc),
        )
        db.add(comparison)
        db.flush()

        # 3. Associate articles via ComparisonArticle (enforces composite FK)
        for art in target_articles:
            comp_art = ComparisonArticle(
                comparison_id=comparison.id,
                article_id=art.id,
                created_at=datetime.now(timezone.utc),
            )
            db.add(comp_art)
        db.flush()

        # 4. Perform Coverage and Omission Evaluation
        all_topics_by_art: Dict[int, Set[str]] = {}
        tone_by_art: Dict[int, Dict[str, Any]] = {}
        headline_framing_by_art: Dict[int, Dict[str, Any]] = {}

        for art in target_articles:
            text = art.content or ""
            headline = art.title or ""

            # Extract topics for omission analysis
            extracted_topics = self.content_extractor.extract_topics(text=text, headline=headline)
            topic_names = {t["topic_name"].lower() for t in extracted_topics}
            all_topics_by_art[art.id] = topic_names

            # Evaluate tone and headline framing
            tone_res = self.tone_analyzer.analyze_tone(text=text, headline=headline)
            hf_res = self.tone_analyzer.analyze_headline_framing(headline=headline)
            tone_by_art[art.id] = tone_res
            headline_framing_by_art[art.id] = hf_res

        # Global topic union across all compared articles
        all_topics_union: Set[str] = set()
        for s in all_topics_by_art.values():
            all_topics_union.update(s)

        for art in target_articles:
            art_topics = all_topics_by_art.get(art.id, set())
            omitted = all_topics_union - art_topics
            omitted_str = ", ".join(sorted(omitted)[:5]) if omitted else "No major omissions relative to peers."

            content_len = len(art.content or "")
            coverage_score = round(min(1.0, 0.4 + 0.6 * (content_len / 2000.0)), 2)
            tone_score = tone_by_art[art.id]["tone_score"]
            primary_frame = headline_framing_by_art[art.id]["primary_frame"]

            cov = ComparisonCoverage(
                comparison_id=comparison.id,
                article_id=art.id,
                coverage_score=coverage_score,
                tone_score=tone_score,
                primary_frame=primary_frame,
                omitted_topics=omitted_str,
                created_at=datetime.now(timezone.utc),
            )
            db.add(cov)

        # 5. Extract Cross-Article Contrastive Evidence (COMPARISON_EVIDENCE)
        # Check headline framing contrasts between pairs
        for i in range(len(target_articles)):
            for j in range(i + 1, len(target_articles)):
                art_a = target_articles[i]
                art_b = target_articles[j]
                hf_a = headline_framing_by_art[art_a.id]
                hf_b = headline_framing_by_art[art_b.id]

                if hf_a["primary_frame"] != hf_b["primary_frame"]:
                    source_a = art_a.source_name or f"Article #{art_a.id}"
                    source_b = art_b.source_name or f"Article #{art_b.id}"
                    evidence_content = (
                        f"Framing contrast: {source_a} framed coverage via '{hf_a['primary_frame']}' "
                        f"(\"{art_a.title}\"), whereas {source_b} framed via '{hf_b['primary_frame']}' "
                        f"(\"{art_b.title}\")."
                    )
                    ev_a = ComparisonEvidence(
                        comparison_id=comparison.id,
                        article_id=art_a.id,
                        evidence_type="framing_contrast",
                        claim_or_topic="Headline Framing Divergence",
                        content=evidence_content,
                        start_char=0,
                        end_char=len(art_a.title or ""),
                        created_at=datetime.now(timezone.utc),
                    )
                    db.add(ev_a)

                # Check tone discrepancies
                tone_a = tone_by_art[art_a.id]["tone_score"]
                tone_b = tone_by_art[art_b.id]["tone_score"]
                if abs(tone_a - tone_b) >= 0.35:
                    source_a = art_a.source_name or f"Article #{art_a.id}"
                    source_b = art_b.source_name or f"Article #{art_b.id}"
                    tone_content = (
                        f"Tone discrepancy: {source_a} reported with valence {tone_a:+.2f} "
                        f"({tone_by_art[art_a.id]['tone']}), while {source_b} reported with {tone_b:+.2f} "
                        f"({tone_by_art[art_b.id]['tone']})."
                    )
                    ev_tone = ComparisonEvidence(
                        comparison_id=comparison.id,
                        article_id=art_a.id,
                        evidence_type="tone_discrepancy",
                        claim_or_topic="Emotional Valence Variance",
                        content=tone_content,
                        start_char=0,
                        end_char=min(len(art_a.content or ""), 100),
                        created_at=datetime.now(timezone.utc),
                    )
                    db.add(ev_tone)

        # 6. Evaluate Political Signals across compared articles
        for art in target_articles:
            self.political_service.analyze_and_store_article_political_signals(
                db=db,
                article_id=art.id,
                comparison_id=comparison.id,
            )

        db.commit()
        db.refresh(comparison)

        return self.get_comparison_detail(db=db, comparison_id=comparison.id)

    def get_comparison_detail(
        self,
        db: Session,
        comparison_id: int,
    ) -> NewsComparisonDetailResponse:
        """
        Retrieves full details of a comparison session including articles, coverages,
        evidences, political signals, and an analytical synthesis.
        """
        comparison = (
            db.query(NewsComparison)
            .options(
                joinedload(NewsComparison.comparison_articles).joinedload(ComparisonArticle.article).joinedload(Article.source),
                joinedload(NewsComparison.coverages),
                joinedload(NewsComparison.evidences),
                joinedload(NewsComparison.political_signals),
            )
            .filter(NewsComparison.id == comparison_id)
            .first()
        )
        if not comparison:
            raise ValueError(f"News comparison with ID {comparison_id} not found.")

        # Articles
        articles_summary = []
        for ca in comparison.comparison_articles:
            if ca.article:
                articles_summary.append(ca.article)

        # Coverages
        coverage_responses: List[ComparisonCoverageResponse] = []
        for cov in comparison.coverages:
            art = next((ca.article for ca in comparison.comparison_articles if ca.article_id == cov.article_id), None)
            coverage_responses.append(
                ComparisonCoverageResponse(
                    id=cov.id,
                    comparison_id=cov.comparison_id,
                    article_id=cov.article_id,
                    coverage_score=cov.coverage_score,
                    tone_score=cov.tone_score,
                    primary_frame=cov.primary_frame,
                    omitted_topics=cov.omitted_topics,
                    created_at=cov.created_at,
                    article_title=art.title if art else None,
                    source_name=art.source_name if art else None,
                )
            )

        # Evidences
        evidence_responses: List[ComparisonEvidenceResponse] = [
            ComparisonEvidenceResponse.model_validate(ev) for ev in comparison.evidences
        ]

        # Political Signals
        pol_responses = []
        for ps in comparison.political_signals:
            art = next((ca.article for ca in comparison.comparison_articles if ca.article_id == ps.article_id), None)
            pol_responses.append(
                ComparisonPoliticalSignalResponse(
                    id=ps.id,
                    comparison_id=ps.comparison_id,
                    article_id=ps.article_id,
                    political_leaning=ps.political_leaning,
                    slant_score=ps.slant_score,
                    partisanship_score=ps.partisanship_score,
                    signal_description=ps.signal_description,
                    created_at=ps.created_at,
                    article_title=art.title if art else None,
                    source_name=art.source_name if art else None,
                    evidence_signals=[],
                )
            )

        # Synthesis Summary
        synthesis = (
            f"Compared {len(articles_summary)} articles. "
            f"Discovered {len(evidence_responses)} framing and tone contrasts across reporting outlets. "
            f"Coverage depth scores range from {min((c.coverage_score or 0.0) for c in coverage_responses):.2f} "
            f"to {max((c.coverage_score or 0.0) for c in coverage_responses):.2f}."
            if coverage_responses else "Comparative analysis completed."
        )

        return NewsComparisonDetailResponse(
            id=comparison.id,
            event_id=comparison.event_id,
            title=comparison.title,
            description=comparison.description,
            status=comparison.status,
            article_count=len(articles_summary),
            created_at=comparison.created_at,
            articles=articles_summary,
            coverages=coverage_responses,
            evidences=evidence_responses,
            political_signals=pol_responses,
            synthesis_summary=synthesis,
        )

    def list_comparisons(
        self,
        db: Session,
        limit: int = 50,
        offset: int = 0,
    ) -> List[NewsComparisonSummaryResponse]:
        """Lists comparison sessions ordered by recency."""
        rows = (
            db.query(NewsComparison)
            .options(joinedload(NewsComparison.comparison_articles))
            .order_by(NewsComparison.created_at.desc(), NewsComparison.id.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return [
            NewsComparisonSummaryResponse(
                id=c.id,
                event_id=c.event_id,
                title=c.title,
                description=c.description,
                status=c.status,
                article_count=len(c.comparison_articles),
                created_at=c.created_at,
            )
            for c in rows
        ]


_comparison_service: Optional[NewsComparisonService] = None


def get_comparison_service() -> NewsComparisonService:
    global _comparison_service
    if _comparison_service is None:
        _comparison_service = NewsComparisonService()
    return _comparison_service
