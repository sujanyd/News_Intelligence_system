"""
Entity SQLAlchemy ORM Model.

Represents a real-world named entity (person, organization, location, concept, etc.)
referenced across news articles.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Entity(Base):
    """
    ENTITY Table.
    Stores canonical entity definitions and classifications.
    """

    __tablename__ = "entities"

    id = Column(Integer, primary_key=True, index=True)

    # Canonical unique entity name (e.g., 'United Nations', 'Reuters', 'Joe Biden')
    name = Column(String(255), nullable=False, unique=True, index=True)

    # Classification type: 'PERSON', 'ORGANIZATION', 'LOCATION', 'CONCEPT', 'GOVERNMENT'
    entity_type = Column(String(100), nullable=False, index=True)

    # Informational description or summary
    description = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    aliases = relationship("EntityAlias", back_populates="entity", cascade="all, delete-orphan")
    analyses = relationship("AnalysisEntity", back_populates="entity", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Entity(id={self.id}, name='{self.name}', type='{self.entity_type}')>"
