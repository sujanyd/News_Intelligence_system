"""
ComparisonEvidence SQLAlchemy ORM Model.

Stores granular evidence of contrast, discrepancies, selective omissions,
and rhetorical divergence discovered between articles during a comparison.
Uses composite foreign key (comparison_id, article_id) targeting comparison_articles
to enforce that referenced articles strictly belong to the associated comparison.
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKeyConstraint,
    CheckConstraint,
)
from sqlalchemy.orm import relationship, foreign
from sqlalchemy.sql import func

from app.db.base import Base


class ComparisonEvidence(Base):
    """
    COMPARISON_EVIDENCE Table.
    Stores evidence items pointing out framing contrasts, quote choices, or omissions.
    """

    __tablename__ = "comparison_evidences"

    id = Column(Integer, primary_key=True, index=True)

    # Required reference to the parent comparison
    comparison_id = Column(Integer, nullable=False, index=True)

    # Optional reference to a specific article in the comparison (nullable for cross-article comparisons)
    article_id = Column(Integer, nullable=True, index=True)

    # Type of evidence: 'framing_contrast', 'omission', 'tone_discrepancy', 'headline_bias', 'quote_selection'
    evidence_type = Column(String(100), nullable=False)

    # Topic or claim the evidence relates to
    claim_or_topic = Column(String(512), nullable=True)

    # Excerpt or detailed text explaining the evidence
    content = Column(Text, nullable=False)

    # Character position boundaries if pointing to specific article text
    start_char = Column(Integer, nullable=True)
    end_char = Column(Integer, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        ForeignKeyConstraint(
            ["comparison_id"],
            ["news_comparisons.id"],
            ondelete="CASCADE",
            name="fk_comparison_evidences_comparison",
        ),
        # Composite foreign key ensures article_id belongs to this specific comparison
        ForeignKeyConstraint(
            ["comparison_id", "article_id"],
            ["comparison_articles.comparison_id", "comparison_articles.article_id"],
            ondelete="CASCADE",
            name="fk_comparison_evidences_comparison_article",
        ),
        CheckConstraint(
            "start_char IS NULL OR end_char IS NULL OR start_char <= end_char",
            name="ck_comparison_evidences_char_range",
        ),
    )

    # Relationships
    comparison = relationship(
        "NewsComparison",
        back_populates="evidences",
        primaryjoin="foreign(ComparisonEvidence.comparison_id) == NewsComparison.id",
        overlaps="evidences",
    )
    comparison_article = relationship(
        "ComparisonArticle",
        back_populates="evidences",
        primaryjoin="and_(foreign(ComparisonEvidence.comparison_id)==ComparisonArticle.comparison_id, "
                    "foreign(ComparisonEvidence.article_id)==ComparisonArticle.article_id)",
        overlaps="comparison,evidences",
    )


    def __repr__(self) -> str:
        return (
            f"<ComparisonEvidence(id={self.id}, comp_id={self.comparison_id}, "
            f"type='{self.evidence_type}')>"
        )
