"""
Database declarative base.

All SQLAlchemy ORM models will inherit from this Base class.
"""

from sqlalchemy.orm import declarative_base

# Base class for SQLAlchemy ORM models
Base = declarative_base()
