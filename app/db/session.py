"""
Database session management.

Configures the SQLAlchemy engine and sessionmaker for PostgreSQL.
Provides a reusable database dependency generator for FastAPI routes.
"""

from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings

# Create SQLAlchemy engine connected to PostgreSQL
# SQLAlchemy does not establish a network connection until a query is executed,
# which allows the application to start up safely even before the DB is provisioned.
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
)

# SessionLocal is a session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that generates a new database session per request.
    Ensures that the session is always closed when the request is finished.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
