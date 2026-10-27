"""
NewsComparison SQLAlchemy ORM Model.

Represents a multi-article comparative analysis session.
Compares framing, narrative divergence, coverage depth, and political signals
across multiple news outlets for a specific Event or relevant group of Articles.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship, foreign
from sqlalchemy.sql import func

from app.db.base import Base


class NewsComparison(Base):
    """
    NEWS_COMPARISON Table.
    Orchestrates comparison sessions grouping multiple articles across publishers.
    """

    __tablename__ = "news_comparisons"

    id = Column(Integer, primary_key=True, index=True)

    # Optional reference to a specific real-world Event (can also be a custom group of articles)
    event_id = Column(
        Integer,
        ForeignKey("events.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    title = Column(String(512), nullable=False)
    description = Column(Text, nullable=True)

    # Comparison processing status: 'pending', 'processing', 'completed', 'failed'
    status = Column(String(50), nullable=False, default="completed")

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    event = relationship("Event", back_populates="comparisons")
    comparison_articles = relationship(
        "ComparisonArticle",
        back_populates="comparison",
        cascade="all, delete-orphan",
    )
    evidences = relationship(
        "ComparisonEvidence",
        back_populates="comparison",
        cascade="all, delete-orphan",
        primaryjoin="NewsComparison.id == foreign(ComparisonEvidence.comparison_id)",
    )
    coverages = relationship(
        "ComparisonCoverage",
        back_populates="comparison",
        cascade="all, delete-orphan",
        primaryjoin="NewsComparison.id == foreign(ComparisonCoverage.comparison_id)",
    )
    political_signals = relationship(
        "ComparisonPoliticalSignal",
        back_populates="comparison",
        cascade="all, delete-orphan",
        primaryjoin="NewsComparison.id == foreign(ComparisonPoliticalSignal.comparison_id)",
    )
    reports = relationship(
        "Report",
        back_populates="comparison",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<NewsComparison(id={self.id}, title='{self.title[:30]}...', status='{self.status}')>"
