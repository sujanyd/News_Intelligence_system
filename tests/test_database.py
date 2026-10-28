"""
Tests for Database Models, Relationships, and Constraints.

Validates all 21 models across the News Bias and Framing Analysis System,
including foreign-key integrity, unique constraints, check constraints,
composite foreign keys, self-referencing duplicates, and evidence structures.
"""

from datetime import datetime, timezone
import uuid
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError, OperationalError

from app.core.config import settings
from app.models import (
    Base,
    NewsSource,
    Story,
    Event,
    Article,
    ArticleEmbedding,
    ArticleMatch,
    ArticleAnalysis,
    AnalysisTopic,
    AnalysisFact,
    AnalysisQuote,
    AnalysisFramingSignal,
    Entity,
    EntityAlias,
    AnalysisEntity,
    NewsComparison,
    ComparisonArticle,
    ComparisonEvidence,
    ComparisonCoverage,
    ComparisonPoliticalSignal,
    AIDetectionResult,
    Report,
)
from app.db.seed import seed_database


def _normalize_tz(dt: datetime | None) -> datetime | None:
    """Normalize datetime to UTC if naive (e.g. SQLite dialect)."""
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


# =============================================================================
# Core Models Tests (Preserved from Previous Milestone)
# =============================================================================


def test_create_news_source(db_session):
    """Test creating and querying a NewsSource record."""
    source = NewsSource(
        name="Associated Press",
        base_url="https://apnews.com",
    )
    db_session.add(source)
    db_session.commit()

    retrieved = db_session.query(NewsSource).filter_by(name="Associated Press").first()
    assert retrieved is not None
    assert retrieved.id is not None
    assert retrieved.name == "Associated Press"
    assert retrieved.base_url == "https://apnews.com"
    assert retrieved.created_at is not None


def test_news_source_unique_name_constraint(db_session):
    """Test that duplicate source names are rejected."""
    source1 = NewsSource(name="BBC", base_url="https://bbc.com")
    db_session.add(source1)
    db_session.commit()

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            source2 = NewsSource(name="BBC", base_url="https://bbc.co.uk")
            db_session.add(source2)
            db_session.flush()


def test_create_story_and_event_relationship(db_session):
    """Test creating a Story and an associated Event, checking the relationship."""
    story = Story(title="Mars Exploration Rover 2026")
    db_session.add(story)
    db_session.commit()

    event_time = datetime(2026, 8, 12, 10, 0, tzinfo=timezone.utc)
    event = Event(
        story_id=story.id,
        event_time=event_time,
        event_time_precision="exact",
        event_time_disagreement=False,
    )
    db_session.add(event)
    db_session.commit()

    retrieved_story = db_session.query(Story).filter_by(id=story.id).first()
    assert len(retrieved_story.events) == 1
    assert retrieved_story.events[0].id == event.id
    assert _normalize_tz(retrieved_story.events[0].event_time) == event_time
    assert retrieved_story.events[0].event_time_precision == "exact"
    assert retrieved_story.events[0].event_time_disagreement is False

    assert event.story.id == story.id
    assert event.story.title == "Mars Exploration Rover 2026"


def test_create_article_with_source_and_event(db_session):
    """Test creating an Article linked to a NewsSource and an Event."""
    source = NewsSource(name="The Guardian", base_url="https://theguardian.com")
    story = Story(title="Renewable Energy Transition")
    db_session.add_all([source, story])
    db_session.commit()

    event = Event(
        story_id=story.id,
        event_time=datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc),
        event_time_precision="date",
    )
    db_session.add(event)
    db_session.commit()

    pub_time = datetime(2026, 5, 1, 14, 30, tzinfo=timezone.utc)
    article = Article(
        source_id=source.id,
        event_id=event.id,
        title="Solar Generation Hits Record Highs",
        content="Solar energy production reached historical milestones this quarter...",
        url="https://theguardian.com/environment/solar-record-2026",
        published_at=pub_time,
    )
    db_session.add(article)
    db_session.commit()

    saved_article = db_session.query(Article).filter_by(url="https://theguardian.com/environment/solar-record-2026").first()
    assert saved_article is not None
    assert saved_article.source.name == "The Guardian"
    assert saved_article.event.id == event.id
    assert saved_article.event.story.title == "Renewable Energy Transition"

    assert len(source.articles) == 1
    assert source.articles[0].id == saved_article.id
    assert len(event.articles) == 1
    assert event.articles[0].id == saved_article.id


def test_event_time_independent_from_article_timestamps(db_session):
    """
    Verify event occurrence time is completely distinct from
    article publication and retrieval times.
    """
    source = NewsSource(name="TechCrunch", base_url="https://techcrunch.com")
    story = Story(title="AI Breakthrough Announcement")
    db_session.add_all([source, story])
    db_session.commit()

    incident_time = datetime(2026, 9, 15, 8, 0, tzinfo=timezone.utc)
    event = Event(story_id=story.id, event_time=incident_time, event_time_precision="exact")
    db_session.add(event)
    db_session.commit()

    publish_time = datetime(2026, 9, 15, 11, 30, tzinfo=timezone.utc)
    article = Article(
        source_id=source.id,
        event_id=event.id,
        title="New Open-Source Model Released",
        content="A research consortium has released a new foundation model...",
        url="https://techcrunch.com/2026/09/15/open-source-model",
        published_at=publish_time,
    )
    db_session.add(article)
    db_session.commit()

    retrieved_article = db_session.query(Article).filter_by(id=article.id).first()
    retrieved_event = db_session.query(Event).filter_by(id=event.id).first()

    assert _normalize_tz(retrieved_event.event_time) == incident_time
    assert _normalize_tz(retrieved_article.published_at) == publish_time
    assert retrieved_article.retrieved_at is not None
    assert _normalize_tz(retrieved_event.event_time) != _normalize_tz(retrieved_article.published_at)
    assert _normalize_tz(retrieved_article.published_at) != _normalize_tz(retrieved_article.retrieved_at)


def test_seed_database_function(db_session):
    """Verify that seed_database populates initial sample data."""
    data = seed_database(db_session)

    assert data["source"].name == "Reuters"
    assert data["story"].title == "Global Clean Energy Summit 2026"
    assert data["event"].story_id == data["story"].id
    assert data["article"].source_id == data["source"].id
    assert data["article"].event_id == data["event"].id

    assert data["story"].events[0].id == data["event"].id
    assert data["event"].articles[0].id == data["article"].id
    assert data["article"].source.name == "Reuters"
    assert data["article"].event.story.title == "Global Clean Energy Summit 2026"


def test_postgresql_live_connection_and_core_models():
    """
    Live PostgreSQL Integration Test:
    Verifies that the configured PostgreSQL database (from DATABASE_URL)
    is reachable, accepts connections, and correctly supports CRUD operations
    and foreign-key relationships across the four core models:
    NewsSource -> Story -> Event -> Article.

    Gracefully skips if PostgreSQL is not currently running or reachable.
    """
    if not settings.DATABASE_URL.startswith("postgresql"):
        pytest.skip("Configured DATABASE_URL is not PostgreSQL.")

    try:
        engine = create_engine(settings.DATABASE_URL, connect_args={"connect_timeout": 3})
        with engine.connect():
            pass
    except OperationalError as err:
        pytest.skip(f"PostgreSQL server not reachable at {settings.DATABASE_URL}: {err}")

    session_factory = sessionmaker(bind=engine)
    session = session_factory()

    try:
        uid = str(uuid.uuid4())[:8]

        # 1. Insert NewsSource
        source = NewsSource(
            name=f"PG Test Source {uid}",
            base_url="https://example.org",
        )
        session.add(source)
        session.flush()

        # 2. Insert Story
        story = Story(
            title=f"PG Test Story Narrative {uid}",
        )
        session.add(story)
        session.flush()

        # 3. Insert Event associated with Story
        event_time = datetime(2026, 10, 28, 12, 0, tzinfo=timezone.utc)
        event = Event(
            story_id=story.id,
            event_time=event_time,
            event_time_precision="exact",
            event_time_disagreement=False,
        )
        session.add(event)
        session.flush()

        # 4. Insert Article associated with NewsSource and Event
        pub_time = datetime(2026, 10, 28, 13, 15, tzinfo=timezone.utc)
        article = Article(
            source_id=source.id,
            event_id=event.id,
            title=f"PG Test Article Headline {uid}",
            content="Sample article content validating PostgreSQL relational constraints.",
            url=f"https://example.org/news/{uid}",
            published_at=pub_time,
        )
        session.add(article)
        session.commit()

        # 5. Query and verify relationships
        saved = session.query(Article).filter_by(id=article.id).first()
        assert saved is not None
        assert saved.source.name == f"PG Test Source {uid}"
        assert saved.event.id == event.id
        assert saved.event.story.title == f"PG Test Story Narrative {uid}"
        assert len(saved.source.articles) == 1
        assert len(saved.event.story.events) == 1

        # 6. Cleanup test records
        session.delete(article)
        session.delete(event)
        session.delete(story)
        session.delete(source)
        session.commit()
    finally:
        session.close()


# =============================================================================
# Schema Completeness Test: All 21 Planned Tables
# =============================================================================


def test_all_21_tables_represented_in_schema():
    """Verify all 21 planned tables exist in Base.metadata."""
    expected_tables = {
        "news_sources",
        "stories",
        "events",
        "articles",
        "article_embeddings",
        "article_matches",
        "article_analyses",
        "analysis_topics",
        "analysis_facts",
        "analysis_quotes",
        "analysis_framing_signals",
        "entities",
        "entity_aliases",
        "analysis_entities",
        "news_comparisons",
        "comparison_articles",
        "comparison_evidences",
        "comparison_coverages",
        "comparison_political_signals",
        "ai_detection_results",
        "reports",
    }
    actual_tables = set(Base.metadata.tables.keys())
    assert actual_tables == expected_tables, f"Missing: {expected_tables - actual_tables}, Extra: {actual_tables - expected_tables}"


# =============================================================================
# Article Enhancements: Content Availability & Duplicate Detection
# =============================================================================


def test_article_content_availability_and_duplicate_detection(db_session):
    """
    Test Article model extensions:
    - content_availability levels ('full_text', 'summary_only', 'headline_only')
    - canonical URL and content hash
    - self-referential duplicate_of_article_id relationship
    """
    source = NewsSource(name="Bloomberg", base_url="https://bloomberg.com")
    db_session.add(source)
    db_session.commit()

    # Original canonical article
    canonical = Article(
        source_id=source.id,
        title="Central Bank Holds Interest Rates Steady",
        content="The Federal Reserve announced it will keep benchmark rates unchanged...",
        url="https://bloomberg.com/news/fed-rates-oct-2026",
        content_availability="full_text",
        canonical_url="https://bloomberg.com/news/fed-rates-oct-2026",
        content_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    )
    db_session.add(canonical)
    db_session.commit()

    # Duplicate syndicated article referencing the canonical article
    syndicated = Article(
        source_id=source.id,
        title="Fed Decides to Maintain Rate Corridor",
        content="Summary: Fed keeps rates unchanged at October meeting.",
        url="https://bloomberg.com/markets/syndicated-fed-update",
        content_availability="summary_only",
        canonical_url=canonical.url,
        content_hash=canonical.content_hash,
        duplicate_of_article_id=canonical.id,
    )
    db_session.add(syndicated)
    db_session.commit()

    # Verify duplicate self-reference relationships
    assert syndicated.duplicate_of.id == canonical.id
    assert len(canonical.duplicates) == 1
    assert canonical.duplicates[0].id == syndicated.id

    # Test headline-only article without full text
    headline_only = Article(
        source_id=source.id,
        title="Breaking: Central Bank Press Conference Concludes",
        content=None,
        url="https://bloomberg.com/alert/fed-conference-ended",
        content_availability="headline_only",
    )
    db_session.add(headline_only)
    db_session.commit()
    assert headline_only.content is None
    assert headline_only.content_availability == "headline_only"

    # Test invalid content_availability check constraint
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            invalid_art = Article(
                source_id=source.id,
                title="Invalid Availability Test",
                content="...",
                url="https://bloomberg.com/invalid-avail",
                content_availability="video_only",
            )
            db_session.add(invalid_art)
            db_session.flush()


# =============================================================================
# ARTICLE_EMBEDDING Tests
# =============================================================================


def test_article_embedding_metadata_and_constraints(db_session):
    """
    Test ArticleEmbedding:
    - Stores metadata and Qdrant vector reference (not raw vector)
    - Enforces uniqueness on (article_id, embedding_type, model_name)
    """
    source = NewsSource(name="CNBC", base_url="https://cnbc.com")
    db_session.add(source)
    db_session.commit()

    article = Article(
        source_id=source.id,
        title="Tech Equities Rebound Sharply",
        content="Tech stocks staged a broad rally on Tuesday...",
        url="https://cnbc.com/tech-rally-2026",
    )
    db_session.add(article)
    db_session.commit()

    embedding = ArticleEmbedding(
        article_id=article.id,
        embedding_type="content",
        model_name="text-embedding-3-small",
        vector_reference="qdrant-point-uuid-7a8b9c",
        dimensions=1536,
    )
    db_session.add(embedding)
    db_session.commit()

    assert embedding.id is not None
    assert embedding.article.title == article.title
    assert len(article.embeddings) == 1

    # Test unique constraint on (article_id, embedding_type, model_name)
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            duplicate_emb = ArticleEmbedding(
                article_id=article.id,
                embedding_type="content",
                model_name="text-embedding-3-small",
                vector_reference="different-point-id",
            )
            db_session.add(duplicate_emb)
            db_session.flush()


# =============================================================================
# ARTICLE_MATCH Tests: Canonical Ordering & Constraint Enforcement
# =============================================================================


def test_article_match_pair_ordering_and_constraints(db_session):
    """
    Test ArticleMatch:
    - Support labels SAME, RELATED, DIFFERENT
    - Prevent self-match via article_id_1 < article_id_2
    - Enforce canonical order to prevent reverse duplicate pair
    - Prevent duplicate representation of the same pair
    - Reject invalid match labels
    """
    source = NewsSource(name="NPR", base_url="https://npr.org")
    db_session.add(source)
    db_session.commit()

    art1 = Article(source_id=source.id, title="Story Alpha", content="...", url="https://npr.org/alpha")
    art2 = Article(source_id=source.id, title="Story Beta", content="...", url="https://npr.org/beta")
    art3 = Article(source_id=source.id, title="Story Gamma", content="...", url="https://npr.org/gamma")
    db_session.add_all([art1, art2, art3])
    db_session.commit()

    # Ensure low < high
    id_low, id_high = min(art1.id, art2.id), max(art1.id, art2.id)

    # 1. Valid match
    match = ArticleMatch(
        article_id_1=id_low,
        article_id_2=id_high,
        match_label="SAME",
        similarity_score=0.92,
        model_name="cross-encoder-news",
    )
    db_session.add(match)
    db_session.commit()
    assert match.id is not None
    assert match.article_1.id == id_low
    assert match.article_2.id == id_high

    # 2. Prevent self-match (id_low == id_low)
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            self_match = ArticleMatch(article_id_1=id_low, article_id_2=id_low, match_label="SAME")
            db_session.add(self_match)
            db_session.flush()

    # 3. Prevent reverse order (id_high, id_low)
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            reverse_match = ArticleMatch(article_id_1=id_high, article_id_2=id_low, match_label="RELATED")
            db_session.add(reverse_match)
            db_session.flush()

    # 4. Prevent duplicate representation of the same pair
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            duplicate_match = ArticleMatch(article_id_1=id_low, article_id_2=id_high, match_label="DIFFERENT")
            db_session.add(duplicate_match)
            db_session.flush()

    # 5. Prevent invalid match label
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            invalid_label = ArticleMatch(article_id_1=id_low, article_id_2=art3.id, match_label="UNKNOWN_LABEL")
            db_session.add(invalid_label)
            db_session.flush()


# =============================================================================
# ARTICLE_ANALYSIS & Granular Evidence Tables
# =============================================================================


def test_article_analysis_and_evidence_tables(db_session):
    """
    Test ArticleAnalysis and its dedicated evidence tables:
    - Multiple analysis runs on the same article
    - AnalysisTopic with character range constraint
    - AnalysisFact with verification status
    - AnalysisQuote distinguishing speaker opinion from publisher narration
    - AnalysisFramingSignal with intensity score and rhetorical frame
    """
    source = NewsSource(name="The Economist", base_url="https://economist.com")
    db_session.add(source)
    db_session.commit()

    article = Article(
        source_id=source.id,
        title="Global Trade Realignment Accelerates",
        content="New regional supply chains emerge amid shifting industrial policies...",
        url="https://economist.com/trade-2026",
    )
    db_session.add(article)
    db_session.commit()

    # Support multiple analysis runs for the same article
    run1 = ArticleAnalysis(
        article_id=article.id,
        pipeline_version="v1.0.0",
        bias_score=-0.1,
        bias_label="center-left",
        sentiment_score=0.2,
        sentiment_label="neutral",
        confidence_score=0.88,
    )
    run2 = ArticleAnalysis(
        article_id=article.id,
        pipeline_version="v2.0.0",
        bias_score=-0.05,
        bias_label="center",
        sentiment_score=0.25,
        sentiment_label="neutral",
        confidence_score=0.95,
    )
    db_session.add_all([run1, run2])
    db_session.commit()

    assert len(article.analyses) == 2

    # Evidence: AnalysisTopic
    topic = AnalysisTopic(
        analysis_id=run1.id,
        topic_name="Supply Chain Diversification",
        relevance_score=0.95,
        start_char=4,
        end_char=35,
        evidence_text="regional supply chains emerge",
    )
    db_session.add(topic)

    # Evidence: AnalysisFact
    fact = AnalysisFact(
        analysis_id=run1.id,
        fact_statement="New regional supply chains have emerged in 2026.",
        verification_status="verified",
        confidence_score=0.9,
    )
    db_session.add(fact)

    # Evidence: AnalysisQuote (distinguishing speaker opinion from narration)
    quote_speaker = AnalysisQuote(
        analysis_id=run1.id,
        quote_text="Diversification is essential to mitigate systemic geopolitical vulnerability.",
        speaker_name="Dr. Jane Croft",
        speaker_title="Chief Trade Economist",
        source_type="speaker_opinion",
        is_opinion=True,
    )
    quote_narrator = AnalysisQuote(
        analysis_id=run1.id,
        quote_text="The transition will prove painful for legacy manufacturing hubs.",
        speaker_name=None,
        source_type="publisher_narration",
        is_opinion=False,
    )
    db_session.add_all([quote_speaker, quote_narrator])

    # Evidence: AnalysisFramingSignal
    framing = AnalysisFramingSignal(
        analysis_id=run1.id,
        frame_type="economic_consequence",
        intensity_score=0.75,
        evidence_text="shifting industrial policies",
        start_char=42,
        end_char=70,
        explanation="Highlights economic policy interventions as drivers of disruption.",
    )
    db_session.add(framing)
    db_session.commit()

    # Query back and verify relationships
    saved_analysis = db_session.query(ArticleAnalysis).filter_by(id=run1.id).first()
    assert len(saved_analysis.topics) == 1
    assert saved_analysis.topics[0].topic_name == "Supply Chain Diversification"
    assert len(saved_analysis.facts) == 1
    assert len(saved_analysis.quotes) == 2
    assert len(saved_analysis.framing_signals) == 1

    # Verify speaker opinion vs narrator distinction
    speaker_q = [q for q in saved_analysis.quotes if q.source_type == "speaker_opinion"][0]
    narrator_q = [q for q in saved_analysis.quotes if q.source_type == "publisher_narration"][0]
    assert speaker_q.speaker_name == "Dr. Jane Croft"
    assert speaker_q.is_opinion is True
    assert narrator_q.source_type == "publisher_narration"
    assert narrator_q.is_opinion is False

    # Check constraint: invalid character range (start_char > end_char)
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            invalid_topic = AnalysisTopic(
                analysis_id=run1.id,
                topic_name="Invalid Range Topic",
                start_char=100,
                end_char=50,
            )
            db_session.add(invalid_topic)
            db_session.flush()


# =============================================================================
# ENTITY, ENTITY_ALIAS, and ANALYSIS_ENTITY Tests
# =============================================================================


def test_entities_aliases_and_analysis_entities(db_session):
    """
    Test Entity, EntityAlias, and AnalysisEntity:
    - Entity uniqueness by name
    - EntityAlias unique constraint per entity
    - AnalysisEntity link between ArticleAnalysis and Entity with mention & sentiment metrics
    """
    source = NewsSource(name="Al Jazeera", base_url="https://aljazeera.com")
    db_session.add(source)
    db_session.commit()

    article = Article(source_id=source.id, title="Security Council Session", content="...", url="https://aljazeera.com/un-2026")
    db_session.add(article)
    db_session.commit()

    analysis = ArticleAnalysis(article_id=article.id, pipeline_version="v1.0.0")
    db_session.add(analysis)
    db_session.commit()

    # 1. Create Entity
    entity = Entity(
        name="United Nations",
        entity_type="ORGANIZATION",
        description="International diplomatic organization",
    )
    db_session.add(entity)
    db_session.commit()

    # 2. Add Aliases
    alias1 = EntityAlias(entity_id=entity.id, alias="UN")
    alias2 = EntityAlias(entity_id=entity.id, alias="U.N.")
    db_session.add_all([alias1, alias2])
    db_session.commit()

    assert len(entity.aliases) == 2

    # Reject duplicate alias for the same entity
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            dup_alias = EntityAlias(entity_id=entity.id, alias="UN")
            db_session.add(dup_alias)
            db_session.flush()

    # 3. Connect Analysis to Entity via AnalysisEntity
    analysis_entity = AnalysisEntity(
        analysis_id=analysis.id,
        entity_id=entity.id,
        mention_count=5,
        sentiment_score=0.4,
        salience_score=0.85,
        role="institutional_actor",
    )
    db_session.add(analysis_entity)
    db_session.commit()

    assert len(analysis.entities) == 1
    assert analysis.entities[0].entity.name == "United Nations"
    assert analysis.entities[0].mention_count == 5

    # Reject duplicate analysis-entity pairing
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            dup_link = AnalysisEntity(analysis_id=analysis.id, entity_id=entity.id)
            db_session.add(dup_link)
            db_session.flush()


# =============================================================================
# NEWS_COMPARISON & Composite Foreign-Key Integrity Tests
# =============================================================================


def test_news_comparison_and_composite_fk_constraints(db_session):
    """
    Test NewsComparison, ComparisonArticle, ComparisonEvidence, ComparisonCoverage,
    and ComparisonPoliticalSignal:
    - Comparison connects multiple articles via ComparisonArticle
    - Enforce composite foreign key constraint: comparison details MUST reference
      an article belonging to that comparison session
    - Reject comparison details pointing to articles outside the comparison
    """
    source1 = NewsSource(name="Wall Street Journal", base_url="https://wsj.com")
    source2 = NewsSource(name="Washington Post", base_url="https://washingtonpost.com")
    story = Story(title="National Infrastructure Bill")
    db_session.add_all([source1, source2, story])
    db_session.commit()

    event = Event(story_id=story.id)
    db_session.add(event)
    db_session.commit()

    art1 = Article(source_id=source1.id, event_id=event.id, title="WSJ Infrastructure Analysis", content="...", url="https://wsj.com/infra")
    art2 = Article(source_id=source2.id, event_id=event.id, title="WaPo Infrastructure Report", content="...", url="https://wapo.com/infra")
    art_outside = Article(source_id=source1.id, title="Unrelated Tech Article", content="...", url="https://wsj.com/tech-unrelated")
    db_session.add_all([art1, art2, art_outside])
    db_session.commit()

    # Create NewsComparison
    comp = NewsComparison(
        event_id=event.id,
        title="Infrastructure Bill Coverage Comparison",
        status="completed",
    )
    db_session.add(comp)
    db_session.commit()

    # Link art1 and art2 to this comparison
    ca1 = ComparisonArticle(comparison_id=comp.id, article_id=art1.id)
    ca2 = ComparisonArticle(comparison_id=comp.id, article_id=art2.id)
    db_session.add_all([ca1, ca2])
    db_session.commit()

    assert len(comp.comparison_articles) == 2

    # 1. Valid Evidence linked to ca1
    evidence = ComparisonEvidence(
        comparison_id=comp.id,
        article_id=art1.id,
        evidence_type="framing_contrast",
        claim_or_topic="Fiscal Deficit Impact",
        content="Article focuses prominently on budget deficit projections.",
    )
    db_session.add(evidence)
    db_session.commit()
    assert evidence.id is not None
    assert len(ca1.evidences) == 1

    # 2. Valid Coverage metrics for ca1
    coverage = ComparisonCoverage(
        comparison_id=comp.id,
        article_id=art1.id,
        coverage_score=0.85,
        tone_score=-0.2,
        primary_frame="economic_cost",
    )
    db_session.add(coverage)
    db_session.commit()
    assert ca1.coverage.primary_frame == "economic_cost"

    # 3. Valid Political Signal for ca1
    pol_signal = ComparisonPoliticalSignal(
        comparison_id=comp.id,
        article_id=art1.id,
        political_leaning="center-right",
        slant_score=0.3,
        partisanship_score=0.4,
    )
    db_session.add(pol_signal)
    db_session.commit()
    assert len(ca1.political_signals) == 1

    # 4. COMPOSITE FK ENFORCEMENT:
    # Attempting to insert ComparisonCoverage for an article NOT in the comparison (art_outside)
    # must be rejected by foreign key constraint!
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            rogue_coverage = ComparisonCoverage(
                comparison_id=comp.id,
                article_id=art_outside.id,  # NOT registered in comparison_articles for this comparison!
                coverage_score=0.5,
            )
            db_session.add(rogue_coverage)
            db_session.flush()

    # Similarly, rogue evidence pointing to outside article must be rejected
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            rogue_evidence = ComparisonEvidence(
                comparison_id=comp.id,
                article_id=art_outside.id,
                evidence_type="tone_contrast",
                content="Rogue test content",
            )
            db_session.add(rogue_evidence)
            db_session.flush()


# =============================================================================
# AI_DETECTION_RESULT & REPORT Tests
# =============================================================================


def test_ai_detection_result_model(db_session):
    """
    Test AIDetectionResult:
    - Stores statistical likelihood estimate and model metadata
    - Rejects likelihood outside [0.0, 1.0]
    """
    source = NewsSource(name="Independent Tech", base_url="https://indietech.io")
    db_session.add(source)
    db_session.commit()

    article = Article(source_id=source.id, title="Synthetic Article Test", content="...", url="https://indietech.io/synth-test")
    db_session.add(article)
    db_session.commit()

    detection = AIDetectionResult(
        article_id=article.id,
        ai_likelihood=0.78,
        model_name="roberta-base-openai-detector",
        model_version="v1.2",
        analysis_details='{"perplexity": 24.5, "burstiness": 0.31}',
        confidence_score=0.82,
        is_flagged_for_review=True,
    )
    db_session.add(detection)
    db_session.commit()

    assert detection.id is not None
    assert detection.ai_likelihood == 0.78
    assert detection.article.id == article.id
    assert len(article.ai_detection_results) == 1

    # Check constraint: reject likelihood > 1.0
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            invalid_detection = AIDetectionResult(
                article_id=article.id,
                ai_likelihood=1.5,
                model_name="invalid-model",
            )
            db_session.add(invalid_detection)
            db_session.flush()


def test_report_model_and_comparison_relationship(db_session):
    """
    Test Report model:
    - Storing generated intelligence report metadata and comparison reference
    - Preserving report-to-comparison relationship
    """
    comp = NewsComparison(title="Quarterly Media Framing Synthesis", status="completed")
    db_session.add(comp)
    db_session.commit()

    report = Report(
        comparison_id=comp.id,
        title="Executive Intelligence Report: Framing Discrepancies in Q4",
        summary="Key findings indicate significant narrative divergence between financial and political outlets.",
        content="# Media Framing Analysis\n\n## Overview\nComparative data demonstrates divergence...",
        report_format="markdown",
    )
    db_session.add(report)
    db_session.commit()

    assert report.id is not None
    assert report.comparison.id == comp.id
    assert len(comp.reports) == 1
    assert comp.reports[0].title == "Executive Intelligence Report: Framing Discrepancies in Q4"
