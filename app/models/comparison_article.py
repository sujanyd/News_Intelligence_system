"""
ComparisonArticle SQLAlchemy ORM Model.

Associates an Article with a NewsComparison.
Enforces the composite uniqueness constraint on (comparison_id, article_id) which
serves as the reference target for comparison evidence, coverage, and political signals.
This guarantees that any comparison detail refers strictly to an article that belongs
to that specific comparison.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship, foreign
from sqlalchemy.sql import func

from app.db.base import Base


class ComparisonArticle(Base):
    """
    COMPARISON_ARTICLE Table.
    Links articles to comparisons and provides composite foreign-key integrity.
    """

    __tablename__ = "comparison_articles"

    id = Column(Integer, primary_key=True, index=True)
    comparison_id = Column(
        Integer,
        ForeignKey("news_comparisons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    article_id = Column(
        Integer,
        ForeignKey("articles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("comparison_id", "article_id", name="uq_comparison_articles_comparison_article"),
    )

    # Relationships
    comparison = relationship("NewsComparison", back_populates="comparison_articles")
    article = relationship("Article", back_populates="comparison_articles")

    evidences = relationship(
        "ComparisonEvidence",
        back_populates="comparison_article",
        cascade="all, delete-orphan",
        primaryjoin="and_(ComparisonArticle.comparison_id==foreign(ComparisonEvidence.comparison_id), "
                    "ComparisonArticle.article_id==foreign(ComparisonEvidence.article_id))",
        overlaps="evidences",
    )
    coverage = relationship(
        "ComparisonCoverage",
        back_populates="comparison_article",
        uselist=False,
        cascade="all, delete-orphan",
        primaryjoin="and_(ComparisonArticle.comparison_id==foreign(ComparisonCoverage.comparison_id), "
                    "ComparisonArticle.article_id==foreign(ComparisonCoverage.article_id))",
        overlaps="coverages",
    )
    political_signals = relationship(
        "ComparisonPoliticalSignal",
        back_populates="comparison_article",
        cascade="all, delete-orphan",
        primaryjoin="and_(ComparisonArticle.comparison_id==foreign(ComparisonPoliticalSignal.comparison_id), "
                    "ComparisonArticle.article_id==foreign(ComparisonPoliticalSignal.article_id))",
        overlaps="political_signals",
    )


    def __repr__(self) -> str:
        return (
            f"<ComparisonArticle(id={self.id}, comparison_id={self.comparison_id}, "
            f"article_id={self.article_id})>"
        )
