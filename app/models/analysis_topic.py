"""
AnalysisTopic SQLAlchemy ORM Model.

Represents topical themes and subjects extracted during article analysis.
Preserves relevance scores and text scope/character positions within the article text.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class AnalysisTopic(Base):
    """
    ANALYSIS_TOPIC Table.
    Stores detected topics with confidence/relevance and character boundaries.
    """

    __tablename__ = "analysis_topics"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(
        Integer,
        ForeignKey("article_analyses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    topic_name = Column(String(255), nullable=False, index=True)
    relevance_score = Column(Float, nullable=True)  # 0.0 to 1.0

    # Character scope within the article content
    start_char = Column(Integer, nullable=True)
    end_char = Column(Integer, nullable=True)

    # Excerpt evidence from the source text
    evidence_text = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "start_char IS NULL OR end_char IS NULL OR start_char <= end_char",
            name="ck_analysis_topics_char_range",
        ),
    )

    # Relationship back to analysis
    analysis = relationship("ArticleAnalysis", back_populates="topics")

    def __repr__(self) -> str:
        return f"<AnalysisTopic(id={self.id}, analysis_id={self.analysis_id}, topic='{self.topic_name}')>"
