"""
ArticleMatch SQLAlchemy ORM Model.

Represents pairwise relationship/similarity matches between two news articles.
Enforces canonical pair ordering (article_id_1 < article_id_2) to:
1. Prevent an article from being matched against itself.
2. Prevent duplicate representations of the same unordered article pair.
Supports matching labels: 'SAME', 'RELATED', 'DIFFERENT'.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class ArticleMatch(Base):
    """
    ARTICLE_MATCH Table.
    Stores pairwise matches between articles with classification labels and similarity scores.
    """

    __tablename__ = "article_matches"

    id = Column(Integer, primary_key=True, index=True)
    article_id_1 = Column(
        Integer,
        ForeignKey("articles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    article_id_2 = Column(
        Integer,
        ForeignKey("articles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Classification: 'SAME', 'RELATED', or 'DIFFERENT'
    match_label = Column(String(50), nullable=False)

    # Quantitative similarity metric (0.0 to 1.0)
    similarity_score = Column(Float, nullable=True)

    # Confidence score (0.0 to 1.0)
    confidence_score = Column(Float, nullable=True)

    # Model or algorithm used for matching
    model_name = Column(String(100), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        # Canonical order prevents self-matching (id_1 == id_2) and reverse duplicates (id_2, id_1)
        CheckConstraint("article_id_1 < article_id_2", name="ck_article_matches_canonical_order"),
        CheckConstraint("match_label IN ('SAME', 'RELATED', 'DIFFERENT')", name="ck_article_matches_label"),
        UniqueConstraint("article_id_1", "article_id_2", name="uq_article_matches_pair"),
    )

    # Foreign key relationships
    article_1 = relationship("Article", foreign_keys=[article_id_1])
    article_2 = relationship("Article", foreign_keys=[article_id_2])

    def __repr__(self) -> str:
        return (
            f"<ArticleMatch(id={self.id}, pair=({self.article_id_1}, {self.article_id_2}), "
            f"label='{self.match_label}', score={self.similarity_score})>"
        )
