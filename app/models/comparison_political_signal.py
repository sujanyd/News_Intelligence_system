"""
ComparisonPoliticalSignal SQLAlchemy ORM Model.

Stores political leaning, ideological slant scores, and partisanship indicators
for an article within a comparison session.
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


class ComparisonPoliticalSignal(Base):
    """
    COMPARISON_POLITICAL_SIGNAL Table.
    Stores ideological leaning evaluations for an article in the context of a news comparison.
    """

    __tablename__ = "comparison_political_signals"

    id = Column(Integer, primary_key=True, index=True)
    comparison_id = Column(Integer, nullable=False, index=True)
    article_id = Column(Integer, nullable=False, index=True)

    # Political classification: 'left', 'center-left', 'center', 'center-right', 'right'
    political_leaning = Column(String(50), nullable=False)

    # Quantitative slant score (-1.0 Far-Left to +1.0 Far-Right)
    slant_score = Column(Float, nullable=True)

    # Partisanship intensity score (0.0 Highly Neutral to 1.0 Highly Partisan)
    partisanship_score = Column(Float, nullable=True)

    # Description of political signals detected in this article's coverage
    signal_description = Column(Text, nullable=True)

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
            name="uq_comparison_political_signals_comparison_article",
        ),
        ForeignKeyConstraint(
            ["comparison_id"],
            ["news_comparisons.id"],
            ondelete="CASCADE",
            name="fk_comparison_political_signals_comparison",
        ),
        ForeignKeyConstraint(
            ["comparison_id", "article_id"],
            ["comparison_articles.comparison_id", "comparison_articles.article_id"],
            ondelete="CASCADE",
            name="fk_comparison_political_signals_comparison_article",
        ),
    )

    # Relationships
    comparison = relationship(
        "NewsComparison",
        back_populates="political_signals",
        primaryjoin="foreign(ComparisonPoliticalSignal.comparison_id) == NewsComparison.id",
        overlaps="political_signals",
    )
    comparison_article = relationship(
        "ComparisonArticle",
        back_populates="political_signals",
        primaryjoin="and_(foreign(ComparisonPoliticalSignal.comparison_id)==ComparisonArticle.comparison_id, "
                    "foreign(ComparisonPoliticalSignal.article_id)==ComparisonArticle.article_id)",
        overlaps="comparison,political_signals",
    )


    def __repr__(self) -> str:
        return (
            f"<ComparisonPoliticalSignal(id={self.id}, comp_id={self.comparison_id}, "
            f"article_id={self.article_id}, leaning='{self.political_leaning}')>"
        )
