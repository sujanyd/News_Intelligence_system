"""
ArticleEmbedding SQLAlchemy ORM Model.

Represents vector embedding metadata associated with an article.
High-dimensional dense vector embeddings are stored in Qdrant, while
PostgreSQL stores the model metadata, embedding type, and vector reference ID.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class ArticleEmbedding(Base):
    """
    ARTICLE_EMBEDDING Table.
    Stores metadata for embeddings created for an article (title, content, or summary)
    referencing actual vectors indexed in Qdrant.
    """

    __tablename__ = "article_embeddings"

    id = Column(Integer, primary_key=True, index=True)
    article_id = Column(
        Integer,
        ForeignKey("articles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Embedding type: 'title', 'content', 'summary', 'full_text'
    embedding_type = Column(String(50), nullable=False)

    # Name of the model used to generate embeddings (e.g., 'text-embedding-3-small')
    model_name = Column(String(100), nullable=False)

    # Point ID / reference key locating the vector in Qdrant collection
    vector_reference = Column(String(255), nullable=False)

    # Dimensionality of the vector (e.g., 384, 1536)
    dimensions = Column(Integer, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "article_id",
            "embedding_type",
            "model_name",
            name="uq_article_embeddings_article_type_model",
        ),
    )

    # Relationship back to Article
    article = relationship("Article", back_populates="embeddings")

    def __repr__(self) -> str:
        return (
            f"<ArticleEmbedding(id={self.id}, article_id={self.article_id}, "
            f"type='{self.embedding_type}', model='{self.model_name}')>"
        )
