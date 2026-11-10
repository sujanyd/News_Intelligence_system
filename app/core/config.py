"""
Application Configuration Module.

Loads configuration values from environment variables or the .env file.
Uses Pydantic BaseSettings for validation, typing, and default values.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings and environment variables.
    Provides sane defaults for local development.
    """

    # Project Information
    PROJECT_NAME: str = "News Bias and Framing Analysis System"
    VERSION: str = "0.1.0"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # PostgreSQL Database Connection URL
    # Can be overridden via .env file or environment variable
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/news_bias_db"

    # RSS Ingestion Pipeline Configuration
    RSS_FEED_TIMEOUT_SECONDS: int = 10
    RSS_MAX_RETRIES: int = 2
    RSS_RETRY_BACKOFF_SECONDS: float = 0.5
    RSS_USER_AGENT: str = "NewsBiasIntelligenceBot/1.0 (+https://github.com/sujanyd/News_Intelligence_system)"
    RSS_MAX_ARTICLES_PER_FEED: int = 30

    # Article Embedding Configuration
    # Supported providers: 'sentence-transformers', 'openai', 'gemini', 'mock' (test only)
    EMBEDDING_PROVIDER: str = "sentence-transformers"
    EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIMENSIONS: int = 384
    EMBEDDING_API_KEY: str = ""
    EMBEDDING_BATCH_SIZE: int = 20

    # Vector Database Configuration (Qdrant)
    # Mode: 'memory' for in-memory testing, path (e.g. './qdrant_storage') for local persistence, or remote host/port
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_GRPC_PORT: int = 6334
    QDRANT_URL: str = ""  # If set, used directly (e.g., ':memory:', path to local storage directory, or http URL)
    QDRANT_PATH: str = "./qdrant_data"  # Default directory for persistent local vector database
    QDRANT_API_KEY: str = ""
    QDRANT_COLLECTION_NAME: str = "article_embeddings"
    QDRANT_DISTANCE: str = "Cosine"  # Cosine, Dot, or Euclid
    QDRANT_TIMEOUT_SECONDS: float = 10.0
    QDRANT_PREFER_GRPC: bool = False

    # Configuration for pydantic-settings
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


# Default configured news RSS feeds across major publishers
DEFAULT_RSS_FEEDS: list[dict[str, str]] = [
    {
        "source_name": "BBC News",
        "base_url": "https://www.bbc.com",
        "feed_url": "https://feeds.bbci.co.uk/news/world/rss.xml",
    },
    {
        "source_name": "Reuters",
        "base_url": "https://www.reuters.com",
        "feed_url": "https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best",
    },
    {
        "source_name": "The Guardian",
        "base_url": "https://www.theguardian.com",
        "feed_url": "https://www.theguardian.com/world/rss",
    },
    {
        "source_name": "TechCrunch",
        "base_url": "https://techcrunch.com",
        "feed_url": "https://techcrunch.com/feed/",
    },
    {
        "source_name": "NPR News",
        "base_url": "https://www.npr.org",
        "feed_url": "https://feeds.npr.org/1001/rss.xml",
    },
]


# Global settings instance to import anywhere in the project
settings = Settings()
