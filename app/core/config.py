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

    # Configuration for pydantic-settings
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


# Global settings instance to import anywhere in the project
settings = Settings()
