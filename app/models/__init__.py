"""
SQLAlchemy ORM Models package.

This directory will store database table definitions.
Future models (e.g., Article, BiasAnalysis, Publisher, FramingCategory)
will inherit from Base and be exported here for Alembic migrations.
"""

from app.db.base import Base

__all__ = ["Base"]
