"""
Pytest configuration and shared fixtures.

Provides test client and isolated database session fixtures.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.main import app
from app.models import Base
from app.db.session import get_db

# Use an in-memory SQLite database for fast, isolated, and self-contained tests
TEST_DB_URL = "sqlite:///:memory:"


from sqlalchemy import event

@pytest.fixture(scope="session")
def test_engine():
    """
    Creates the database engine and tables for the test session.
    Enables SQLite foreign key enforcement.
    """
    engine = create_engine(
        TEST_DB_URL,
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)



@pytest.fixture(scope="function")
def db_session(test_engine):
    """
    Yields an isolated database session per test function.
    Rolls back any changes made during the test.
    """
    connection = test_engine.connect()
    transaction = connection.begin()
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=connection)
    session = session_factory()

    yield session

    session.close()
    if transaction.is_active:
        transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def client(db_session):
    """
    FastAPI test client with the database dependency overridden
    to use the isolated test session.
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
