"""
ComparisonCoverage SQLAlchemy ORM Model.

Stores coverage disparity and depth analysis for an article within a comparison.
Evaluates reporting volume/prominence, overall tone, primary narrative framing,
and detected omissions compared against sibling articles.
Enforces composite foreign key (comparison_id, article_id) targeting comparison_articles.
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Text,
    DateTime,
    ForeignKeyConstraint,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship, foreign
from sqlalchemy.sql import func

from app.db.base import Base


class ComparisonCoverage(Base):
    """
    COMPARISON_COVERAGE Table.
    Stores per-article coverage depth and omission tracking within a comparison session.
    """

    __tablename__ = "comparison_coverages"

    id = Column(Integer, primary_key=True, index=True)
    comparison_id = Column(Integer, nullable=False, index=True)
    article_id = Column(Integer, nullable=False, index=True)

    # Coverage depth score (e.g. 0.0 to 1.0 or word/detail density index)
    coverage_score = Column(Float, nullable=True)

    # Measured tone score (-1.0 Negative to +1.0 Positive)
    tone_score = Column(Float, nullable=True)

    # Dominant narrative frame (e.g., 'economic', 'geopolitical', 'humanitarian')
    primary_frame = Column(String(100), nullable=True)

    # Key facts or topics omitted by this article that were covered by others
    omitted_topics = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "comparison_id",
            "article_id",
            name="uq_comparison_coverages_comparison_article",
        ),
        ForeignKeyConstraint(
            ["comparison_id"],
            ["news_comparisons.id"],
            ondelete="CASCADE",
            name="fk_comparison_coverages_comparison",
        ),
        ForeignKeyConstraint(
            ["comparison_id", "article_id"],
            ["comparison_articles.comparison_id", "comparison_articles.article_id"],
            ondelete="CASCADE",
            name="fk_comparison_coverages_comparison_article",
        ),
    )

    # Relationships
    comparison = relationship(
        "NewsComparison",
        back_populates="coverages",
        primaryjoin="foreign(ComparisonCoverage.comparison_id) == NewsComparison.id",
        overlaps="coverage,coverages",
    )

    comparison_article = relationship(
        "ComparisonArticle",
        back_populates="coverage",
        primaryjoin="and_(foreign(ComparisonCoverage.comparison_id)==ComparisonArticle.comparison_id, "
                    "foreign(ComparisonCoverage.article_id)==ComparisonArticle.article_id)",
        overlaps="comparison,coverages",
    )


    def __repr__(self) -> str:
        return (
            f"<ComparisonCoverage(id={self.id}, comp_id={self.comparison_id}, "
            f"article_id={self.article_id}, frame='{self.primary_frame}')>"
        )
