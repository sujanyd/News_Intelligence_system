"""
NewsSource SQLAlchemy ORM Model.

Represents a news publishing organization or media outlet (e.g., BBC, Reuters).
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class NewsSource(Base):
    """
    NEWS_SOURCE Table.
    Stores metadata about media publishers and outlets.
    """

    __tablename__ = "news_sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    base_url = Column(String(512), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationship: One NewsSource publishes many Articles
    articles = relationship(
        "Article",
        back_populates="source",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<NewsSource(id={self.id}, name='{self.name}')>"
