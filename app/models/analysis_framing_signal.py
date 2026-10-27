"""
AnalysisFramingSignal SQLAlchemy ORM Model.

Represents specific narrative framing cues and rhetorical devices detected in the article text
(e.g., economic consequences, humanitarian angle, security threat, conflict, loaded language).
Captures frame categories, intensity, evidence quotes, and character positions.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class AnalysisFramingSignal(Base):
    """
    ANALYSIS_FRAMING_SIGNAL Table.
    Stores framing signals and rhetorical patterns with text evidence and character ranges.
    """

    __tablename__ = "analysis_framing_signals"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(
        Integer,
        ForeignKey("article_analyses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Frame type category (e.g., 'economic', 'humanitarian', 'conflict', 'security', 'loaded_language')
    frame_type = Column(String(100), nullable=False, index=True)

    # Intensity or strength score of the frame (0.0 to 1.0)
    intensity_score = Column(Float, nullable=True)

    # Excerpt of the text exhibiting the framing
    evidence_text = Column(Text, nullable=False)

    # Character boundaries within the article text
    start_char = Column(Integer, nullable=True)
    end_char = Column(Integer, nullable=True)

    # Explanation or context behind this framing signal
    explanation = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "start_char IS NULL OR end_char IS NULL OR start_char <= end_char",
            name="ck_analysis_framing_signals_char_range",
        ),
    )

    # Relationship back to analysis
    analysis = relationship("ArticleAnalysis", back_populates="framing_signals")

    def __repr__(self) -> str:
        return (
            f"<AnalysisFramingSignal(id={self.id}, analysis_id={self.analysis_id}, "
            f"frame='{self.frame_type}', intensity={self.intensity_score})>"
        )
