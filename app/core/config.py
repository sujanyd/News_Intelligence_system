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
    RSS_USER_AGENT: str = "NewsBiasIntelligenceBot/1.0 (+https://github.com/sujanyd/News_Intelligence_system)"
    RSS_MAX_ARTICLES_PER_FEED: int = 30

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
