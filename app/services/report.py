"""
Evidence-Based Report Generation Service.

Responsible for:
1. Synthesizing structured intelligence reports from a completed NewsComparison session.
2. Including:
   - Story and event overview
   - Participating news publishers
   - Articles compared
   - Main factual claims and extracted topics
   - Tone and framing discrepancies
   - Relevant political presentation signals
   - Exact supporting evidence citations
   - Limitations, uncertainty, and methodological boundaries
3. Persisting generated reports in the `REPORT` (`reports`) table.
"""

from datetime import datetime, timezone
import json
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session, joinedload

from app.models.news_comparison import NewsComparison
from app.models.report import Report
from app.schemas.comparison_report import ReportResponse
from app.services.comparison import get_comparison_service

logger = logging.getLogger(__name__)


class ReportGenerationService:
    """
    Synthesizes comparison findings into comprehensive analytical intelligence reports.
    """

    def __init__(self):
        self.comparison_service = get_comparison_service()

    def generate_comparison_report(
        self,
        db: Session,
        comparison_id: int,
        title: Optional[str] = None,
        report_format: str = "markdown",
    ) -> ReportResponse:
        """
        Synthesizes an analytical intelligence report from a NewsComparison session,
        stores the result in the `reports` table, and returns a structured response.
        """
        # Fetch comparison detail with full relationships
        detail = self.comparison_service.get_comparison_detail(db=db, comparison_id=comparison_id)

        report_title = title or f"Intelligence Synthesis: {detail.title}"

        # 1. Gather publishers & articles
        publishers = sorted(list({a.source_name or "Unknown Source" for a in detail.articles}))

        # 2. Compile executive summary
        summary = (
            f"Cross-media comparative analysis across {len(detail.articles)} articles from "
            f"{len(publishers)} publishers ({', '.join(publishers)}). "
            f"Identified {len(detail.evidences)} contrastive evidence signals and "
            f"{len(detail.political_signals)} political leaning evaluations."
        )

        # 3. Generate content body according to requested format
        if report_format == "json":
            content_dict = {
                "title": report_title,
                "comparison_id": comparison_id,
                "summary": summary,
                "publishers": publishers,
                "articles": [
                    {"id": a.id, "title": a.title, "source": a.source_name, "published_at": str(a.published_at)}
                    for a in detail.articles
                ],
                "coverage_evaluation": [
                    {
                        "article_id": c.article_id,
                        "source": c.source_name,
                        "coverage_score": c.coverage_score,
                        "tone_score": c.tone_score,
                        "primary_frame": c.primary_frame,
                        "omissions": c.omitted_topics,
                    }
                    for c in detail.coverages
                ],
                "evidences": [
                    {
                        "type": e.evidence_type,
                        "claim_or_topic": e.claim_or_topic,
                        "content": e.content,
                    }
                    for e in detail.evidences
                ],
                "political_signals": [
                    {
                        "article_id": ps.article_id,
                        "source": ps.source_name,
                        "leaning": ps.political_leaning,
                        "slant": ps.slant_score,
                    }
                    for ps in detail.political_signals
                ],
                "methodological_limitations": (
                    "All classifications, tone evaluations, and political signals represent empirical "
                    "algorithmic approximations. Mentions of political entities do not equate to institutional bias."
                ),
            }
            content_str = json.dumps(content_dict, indent=2)

        elif report_format == "html":
            article_items = "".join(f"<li><strong>{a.source_name}</strong>: {a.title}</li>" for a in detail.articles)
            evidence_items = "".join(f"<li><em>{e.evidence_type}</em>: {e.content}</li>" for e in detail.evidences)
            content_str = f"""<div class="news-intelligence-report">
<h1>{report_title}</h1>
<p class="summary">{summary}</p>
<h2>Compared Outlets</h2>
<ul>{article_items}</ul>
<h2>Key Framing & Tone Evidence</h2>
<ul>{evidence_items}</ul>
<h2>Methodological Limitations</h2>
<p>Analytical outputs are observational estimates based on textual evidence, not established objective truth.</p>
</div>"""

        else:
            # Default Markdown format
            article_lines = "\n".join(
                f"- **{a.source_name or 'Outlet'}**: [{a.title}]({a.url}) (Published: {a.published_at or 'N/A'})"
                for a in detail.articles
            )

            coverage_table = (
                "| Source | Dominant Frame | Tone Score | Coverage Depth | Identified Topic Omissions |\n"
                "|---|---|---|---|---|\n"
            )
            for cov in detail.coverages:
                coverage_table += (
                    f"| {cov.source_name or 'N/A'} | `{cov.primary_frame}` | {cov.tone_score:+.2f} | "
                    f"{cov.coverage_score:.2f} | {cov.omitted_topics} |\n"
                )

            evidence_lines = "\n".join(
                f"- **{ev.evidence_type.replace('_', ' ').title()}** ({ev.claim_or_topic}):\n  > {ev.content}"
                for ev in detail.evidences
            ) or "- No significant framing divergences identified among compared coverage."

            political_lines = "\n".join(
                f"- **{ps.source_name or 'Outlet'}**: Leaning `{ps.political_leaning}` "
                f"(Slant: {ps.slant_score:+.2f}, Partisanship: {ps.partisanship_score:.2f})\n  *{ps.signal_description}*"
                for ps in detail.political_signals
            ) or "- No overt partisan presentation detected."

            content_str = f"""# {report_title}

## Executive Summary
{summary}

---

## 1. Scope & Participating Publishers
{article_lines}

---

## 2. Comparative Coverage & Framing Analysis
{coverage_table}

---

## 3. Grounded Framing Contrasts & Verbatim Evidence
{evidence_lines}

---

## 4. Political Presentation & Leaning Signals
{political_lines}

---

## 5. Methodological Notes & Limitations
- **Observational Nature**: Model predictions and lexicon heuristics represent analytical estimates, not established factual reality.
- **Contextual Independence**: Negative valence or critical scrutiny does not equate to ideological prejudice.
- **Corpus Boundaries**: Analysis is strictly bound to the articles evaluated within this comparison session.
"""

        # Persist report in database
        report = Report(
            comparison_id=comparison_id,
            title=report_title,
            summary=summary,
            content=content_str,
            report_format=report_format,
            created_at=datetime.now(timezone.utc),
        )
        db.add(report)
        db.commit()
        db.refresh(report)

        return ReportResponse(
            id=report.id,
            comparison_id=report.comparison_id,
            title=report.title,
            summary=report.summary,
            content=report.content,
            report_format=report.report_format,
            created_at=report.created_at,
        )

    def get_report(self, db: Session, report_id: int) -> ReportResponse:
        """Retrieves a single intelligence report by ID."""
        rep = db.query(Report).filter(Report.id == report_id).first()
        if not rep:
            raise ValueError(f"Report with ID {report_id} does not exist.")
        return ReportResponse.model_validate(rep)

    def list_reports(self, db: Session, limit: int = 50, offset: int = 0) -> List[ReportResponse]:
        """Lists intelligence reports ordered by recency."""
        rows = (
            db.query(Report)
            .order_by(Report.created_at.desc(), Report.id.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return [ReportResponse.model_validate(r) for r in rows]


_report_service: Optional[ReportGenerationService] = None


def get_report_service() -> ReportGenerationService:
    global _report_service
    if _report_service is None:
        _report_service = ReportGenerationService()
    return _report_service
