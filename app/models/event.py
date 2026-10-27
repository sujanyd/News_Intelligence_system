"""
Event SQLAlchemy ORM Model.

Represents a specific, localized occurrence belonging to a Story.
Tracks when the incident happened, timestamp precision, and any disagreement
among reporting sources regarding the event timeline.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base import Base


class Event(Base):
    """
    EVENT Table.
    Stores specific real-world incidents linked to an overarching Story.
    """

    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    story_id = Column(
        Integer,
        ForeignKey("stories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # The actual timestamp when the real-world incident occurred (nullable)
    event_time = Column(DateTime(timezone=True), nullable=True)

    # Precision indicator: 'exact', 'date', 'range', 'unknown'
    event_time_precision = Column(String(50), nullable=True, default="unknown")

    # True if different news sources report conflicting timelines for this event
    event_time_disagreement = Column(Boolean, default=False, nullable=False)

    # Relationships
    story = relationship("Story", back_populates="events")
    articles = relationship("Article", back_populates="event")
    comparisons = relationship("NewsComparison", back_populates="event")

    def __repr__(self) -> str:
        return f"<Event(id={self.id}, story_id={self.story_id}, precision='{self.event_time_precision}')>"

