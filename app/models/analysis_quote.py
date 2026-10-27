"""
AnalysisQuote SQLAlchemy ORM Model.

Represents direct or indirect quotes extracted from an article.
Crucially distinguishes quoted speaker opinions from publisher narration,
and records speaker metadata and character positions in the text.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, Float, Text, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class AnalysisQuote(Base):
    """
    ANALYSIS_QUOTE Table.
    Stores quotations, attributed speakers, and differentiates quoted opinions
    from editorial/publisher narration.
    """

    __tablename__ = "analysis_quotes"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(
        Integer,
        ForeignKey("article_analyses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    quote_text = Column(Text, nullable=False)
    speaker_name = Column(String(255), nullable=True)
    speaker_title = Column(String(255), nullable=True)

    # Distinguishes quoted external speaker opinions from journalistic/publisher narration
    # 'speaker_opinion' vs 'publisher_narration'
    source_type = Column(String(50), nullable=False, default="speaker_opinion")

    # Flag denoting whether this quote conveys an opinion vs an objective quote
    is_opinion = Column(Boolean, default=True, nullable=False)

    # Local sentiment or tone of the quotation
    sentiment_score = Column(Float, nullable=True)

    # Character boundaries within the article text
    start_char = Column(Integer, nullable=True)
    end_char = Column(Integer, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "source_type IN ('speaker_opinion', 'publisher_narration')",
            name="ck_analysis_quotes_source_type",
        ),
        CheckConstraint(
            "start_char IS NULL OR end_char IS NULL OR start_char <= end_char",
            name="ck_analysis_quotes_char_range",
        ),
    )

    # Relationship back to analysis
    analysis = relationship("ArticleAnalysis", back_populates="quotes")

    def __repr__(self) -> str:
        return (
            f"<AnalysisQuote(id={self.id}, speaker='{self.speaker_name}', "
            f"type='{self.source_type}', is_opinion={self.is_opinion})>"
        )
