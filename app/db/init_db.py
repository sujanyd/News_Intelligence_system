"""
Database initialization script.

Creates all database tables defined in the SQLAlchemy models.
Usage:
    python -m app.db.init_db
"""

from app.db.session import engine
from app.models import Base  # noqa: F401 registers models with Base.metadata


def init_db() -> None:
    """Create all tables in the configured database."""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully.")


if __name__ == "__main__":
    init_db()
