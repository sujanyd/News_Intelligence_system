"""
AnalysisFact SQLAlchemy ORM Model.

Represents factual claims and assertions identified within an article.
Tracks statement text, verification status, confidence score, and character positions.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class AnalysisFact(Base):
    """
    ANALYSIS_FACT Table.
    Stores factual assertions extracted during analysis, retaining character positions
    and verification indicators.
    """

    __tablename__ = "analysis_facts"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(
        Integer,
        ForeignKey("article_analyses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    fact_statement = Column(Text, nullable=False)
    verification_status = Column(String(50), nullable=True, default="unverified")  # 'verified', 'disputed', 'unverified'

    # Character boundaries for the factual claim in the article content
    start_char = Column(Integer, nullable=True)
    end_char = Column(Integer, nullable=True)

    evidence_text = Column(Text, nullable=True)
    confidence_score = Column(Float, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "start_char IS NULL OR end_char IS NULL OR start_char <= end_char",
            name="ck_analysis_facts_char_range",
        ),
    )

    # Relationship back to analysis
    analysis = relationship("ArticleAnalysis", back_populates="facts")

    def __repr__(self) -> str:
        return f"<AnalysisFact(id={self.id}, analysis_id={self.analysis_id}, status='{self.verification_status}')>"
