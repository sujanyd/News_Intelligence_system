"""
AnalysisEntity SQLAlchemy ORM Model.

Associates an article analysis run with an extracted Entity.
Captures entity-specific metrics including mention counts, local sentiment,
salience/prominence within the article, and semantic role.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class AnalysisEntity(Base):
    """
    ANALYSIS_ENTITY Table.
    Intersection and enrichment table connecting ArticleAnalysis with Entity.
    """

    __tablename__ = "analysis_entities"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(
        Integer,
        ForeignKey("article_analyses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entity_id = Column(
        Integer,
        ForeignKey("entities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Number of times this entity appears in the analyzed article
    mention_count = Column(Integer, default=1, nullable=False)

    # Sentiment leaning specifically targeting this entity (-1.0 to +1.0)
    sentiment_score = Column(Float, nullable=True)

    # Salience / prominence score (0.0 to 1.0)
    salience_score = Column(Float, nullable=True)

    # Role in the narrative (e.g., 'protagonist', 'antagonist', 'subject', 'quoted_source')
    role = Column(String(100), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("analysis_id", "entity_id", name="uq_analysis_entities_analysis_entity"),
    )

    # Relationships
    analysis = relationship("ArticleAnalysis", back_populates="entities")
    entity = relationship("Entity", back_populates="analyses")

    def __repr__(self) -> str:
        return (
            f"<AnalysisEntity(id={self.id}, analysis_id={self.analysis_id}, "
            f"entity_id={self.entity_id}, mentions={self.mention_count})>"
        )
