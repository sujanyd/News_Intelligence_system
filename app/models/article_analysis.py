"""
ArticleAnalysis SQLAlchemy ORM Model.

Represents an analytical evaluation run performed on an article.
Supports multiple analysis runs per article (e.g., across model updates or pipeline iterations).
Evidence elements (topics, facts, quotations, framing signals, entity links) are maintained
in dedicated evidence tables rather than duplicating their text within this table.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class ArticleAnalysis(Base):
    """
    ARTICLE_ANALYSIS Table.
    Stores high-level analysis outputs, bias metrics, sentiment scores, and confidence levels.
    """

    __tablename__ = "article_analyses"

    id = Column(Integer, primary_key=True, index=True)
    article_id = Column(
        Integer,
        ForeignKey("articles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Identifies the analysis pipeline or model version used for this run
    pipeline_version = Column(String(100), nullable=False, default="v1.0.0")

    # Processing status: 'pending', 'processing', 'completed', 'failed'
    status = Column(String(50), nullable=False, default="completed")

    # Political bias slant metrics (-1.0 Far-Left to +1.0 Far-Right, or 0.0 Center)
    bias_score = Column(Float, nullable=True)
    bias_label = Column(String(50), nullable=True)  # 'left', 'center-left', 'center', 'center-right', 'right'

    # Sentiment & tone score (-1.0 Negative to +1.0 Positive)
    sentiment_score = Column(Float, nullable=True)
    sentiment_label = Column(String(50), nullable=True)  # 'positive', 'neutral', 'negative'

    # Overall pipeline confidence score (0.0 to 1.0)
    confidence_score = Column(Float, nullable=True)

    # Inferred article language
    language = Column(String(20), nullable=True, default="en")

    # Brief analytical summary
    summary = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    article = relationship("Article", back_populates="analyses")

    # Dedicated evidence and extracted structure tables
    topics = relationship("AnalysisTopic", back_populates="analysis", cascade="all, delete-orphan")
    facts = relationship("AnalysisFact", back_populates="analysis", cascade="all, delete-orphan")
    quotes = relationship("AnalysisQuote", back_populates="analysis", cascade="all, delete-orphan")
    framing_signals = relationship("AnalysisFramingSignal", back_populates="analysis", cascade="all, delete-orphan")
    entities = relationship("AnalysisEntity", back_populates="analysis", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return (
            f"<ArticleAnalysis(id={self.id}, article_id={self.article_id}, "
            f"version='{self.pipeline_version}', bias='{self.bias_label}')>"
        )
