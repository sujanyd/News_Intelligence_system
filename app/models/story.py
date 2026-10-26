"""
Story SQLAlchemy ORM Model.

Represents an overarching news narrative or topic (e.g., '2026 UN Climate Summit').
A story can encompass multiple specific events over time.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Story(Base):
    """
    STORY Table.
    Stores overarching news narratives and topics.
    """

    __tablename__ = "stories"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(512), nullable=False, index=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationship: One Story groups multiple unfolding Events
    events = relationship(
        "Event",
        back_populates="story",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Story(id={self.id}, title='{self.title[:30]}...')>"
