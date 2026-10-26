"""
Article SQLAlchemy ORM Model.

Represents an individual news article published by a NewsSource and optionally
linked to an Event. Keeps publication and retrieval timestamps cleanly separated
from real-world event occurrence times.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
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
    content = Column(Text, nullable=False)
    url = Column(String(1024), unique=True, nullable=False, index=True)

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

    # Relationships
    source = relationship("NewsSource", back_populates="articles")
    event = relationship("Event", back_populates="articles")

    def __repr__(self) -> str:
        return f"<Article(id={self.id}, source_id={self.source_id}, title='{self.title[:30]}...')>"
