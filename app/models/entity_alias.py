"""
EntityAlias SQLAlchemy ORM Model.

Stores alternate names, acronyms, or variants for an entity
(e.g., 'UN', 'U.N.', 'United Nations Organization' -> 'United Nations').
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class EntityAlias(Base):
    """
    ENTITY_ALIAS Table.
    Maps alternative naming variations back to the canonical Entity.
    """

    __tablename__ = "entity_aliases"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(
        Integer,
        ForeignKey("entities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    alias = Column(String(255), nullable=False, index=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("entity_id", "alias", name="uq_entity_aliases_entity_alias"),
    )

    entity = relationship("Entity", back_populates="aliases")

    def __repr__(self) -> str:
        return f"<EntityAlias(id={self.id}, entity_id={self.entity_id}, alias='{self.alias}')>"
