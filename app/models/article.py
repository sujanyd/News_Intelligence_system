"""
Article SQLAlchemy ORM Model.

Represents an individual news article published by a NewsSource and optionally
linked to an Event. Keeps publication and retrieval timestamps cleanly separated
from real-world event occurrence times.
Supports duplicate detection, canonical URL/hash tracking, and content availability levels.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Article(Base):
    """
    ARTICLE Table.
    Stores news articles published by sources and mapped to real-world events.
    """

    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(
        Integer,
        ForeignKey("news_sources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_id = Column(
        Integer,
        ForeignKey("events.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    title = Column(String(512), nullable=False)
    content = Column(Text, nullable=True)
    url = Column(String(1024), unique=True, nullable=False, index=True)

    # Content availability: 'full_text', 'summary_only', 'headline_only'
    content_availability = Column(
        String(50),
        nullable=False,
        default="full_text",
        server_default="full_text",
    )

    # Duplicate detection metadata
    canonical_url = Column(String(1024), nullable=True, index=True)
    content_hash = Column(String(64), nullable=True, index=True)

    # Self-reference for duplicate articles
    duplicate_of_article_id = Column(
        Integer,
        ForeignKey("articles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # When the publisher published this article (nullable)
    published_at = Column(DateTime(timezone=True), nullable=True)

    # When our scraper / ingestion pipeline fetched the article
    retrieved_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Record creation timestamp in our database
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "content_availability IN ('full_text', 'summary_only', 'headline_only')",
            name="ck_articles_content_availability",
        ),
    )

    # Relationships
    source = relationship("NewsSource", back_populates="articles")
    event = relationship("Event", back_populates="articles")

    @property
    def source_name(self) -> str | None:
        """Returns the name of the publishing source, if loaded/available."""
        return self.source.name if self.source else None

    # Self-referencing duplicate relationships
    duplicate_of = relationship(
        "Article",
        remote_side=[id],
        foreign_keys=[duplicate_of_article_id],
        back_populates="duplicates",
    )
    duplicates = relationship(
        "Article",
        foreign_keys=[duplicate_of_article_id],
        back_populates="duplicate_of",
    )

    # Downstream relationships
    embeddings = relationship("ArticleEmbedding", back_populates="article", cascade="all, delete-orphan")
    analyses = relationship("ArticleAnalysis", back_populates="article", cascade="all, delete-orphan")
    ai_detection_results = relationship("AIDetectionResult", back_populates="article", cascade="all, delete-orphan")
    comparison_articles = relationship("ComparisonArticle", back_populates="article", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Article(id={self.id}, source_id={self.source_id}, title='{self.title[:30]}...')>"

