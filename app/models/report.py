"""
Report SQLAlchemy ORM Model.

Stores generated analytical intelligence reports synthesized from a NewsComparison.
Captures executive summaries, formatted narrative content (Markdown/HTML), and creation timestamps.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Report(Base):
    """
    REPORT Table.
    Stores comprehensive analytical intelligence reports linked directly to a NewsComparison.
    """

    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)

    # Foreign key referencing the parent NewsComparison
    comparison_id = Column(
        Integer,
        ForeignKey("news_comparisons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title = Column(String(512), nullable=False)
    summary = Column(Text, nullable=True)
    content = Column(Text, nullable=False)

    # Format of the report body: 'markdown', 'html', 'pdf_json'
    report_format = Column(String(50), nullable=False, default="markdown")

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationship back to the comparison
    comparison = relationship("NewsComparison", back_populates="reports")

    def __repr__(self) -> str:
        return f"<Report(id={self.id}, comparison_id={self.comparison_id}, title='{self.title[:30]}...')>"
