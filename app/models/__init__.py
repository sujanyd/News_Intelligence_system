"""
SQLAlchemy ORM Models package.

Exports all 21 database models and declarative Base.
Importing models here registers them with Base.metadata for Alembic migrations,
database table generation, and relationship resolution.
"""

from app.db.base import Base

# Core Tables (1-4)
from app.models.news_source import NewsSource
from app.models.story import Story
from app.models.event import Event
from app.models.article import Article

# Article Embedding & Matching (5-6)
from app.models.article_embedding import ArticleEmbedding
from app.models.article_match import ArticleMatch

# Article Analysis & Granular Evidence (7-11)
from app.models.article_analysis import ArticleAnalysis
from app.models.analysis_topic import AnalysisTopic
from app.models.analysis_fact import AnalysisFact
from app.models.analysis_quote import AnalysisQuote
from app.models.analysis_framing_signal import AnalysisFramingSignal

# Entities & Relationships (12-14)
from app.models.entity import Entity
from app.models.entity_alias import EntityAlias
from app.models.analysis_entity import AnalysisEntity

# Comparisons & Coverage Details (15-19)
from app.models.news_comparison import NewsComparison
from app.models.comparison_article import ComparisonArticle
from app.models.comparison_evidence import ComparisonEvidence
from app.models.comparison_coverage import ComparisonCoverage
from app.models.comparison_political_signal import ComparisonPoliticalSignal

# AI Detection & Reporting (20-21)
from app.models.ai_detection_result import AIDetectionResult
from app.models.report import Report

__all__ = [
    "Base",
    # Core
    "NewsSource",
    "Story",
    "Event",
    "Article",
    # Embedding & Matching
    "ArticleEmbedding",
    "ArticleMatch",
    # Analysis & Evidence
    "ArticleAnalysis",
    "AnalysisTopic",
    "AnalysisFact",
    "AnalysisQuote",
    "AnalysisFramingSignal",
    # Entities
    "Entity",
    "EntityAlias",
    "AnalysisEntity",
    # Comparisons
    "NewsComparison",
    "ComparisonArticle",
    "ComparisonEvidence",
    "ComparisonCoverage",
    "ComparisonPoliticalSignal",
    # AI Detection & Reporting
    "AIDetectionResult",
    "Report",
]
