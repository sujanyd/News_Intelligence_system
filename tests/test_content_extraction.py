"""
Tests for Article Content Extraction (Topics, Entities, Facts, Quotes).

Validates:
1. Topic extraction with relevance scores and evidence text.
2. Entity extraction (PERSON, ORGANIZATION, LOCATION, CONCEPT) with mention counts and salience.
3. Canonical entity deduplication and reuse across multiple articles/runs.
4. Fact extraction preserving source claim status ('unverified') and confidence.
5. Quote extraction preserving verbatim text, speaker attribution, and opinion flag.
6. Relational persistence in ARTICLE_ANALYSIS, ANALYSIS_TOPIC, ENTITY, ANALYSIS_ENTITY,
   ANALYSIS_FACT, and ANALYSIS_QUOTE.
7. REST API endpoints for extraction, topics, entities, facts, and quotes.
"""

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.analysis_entity import AnalysisEntity
from app.models.analysis_fact import AnalysisFact
from app.models.analysis_quote import AnalysisQuote
from app.models.analysis_topic import AnalysisTopic
from app.models.article import Article
from app.models.article_analysis import ArticleAnalysis
from app.models.entity import Entity
from app.models.news_source import NewsSource
from app.services.content_extraction import ArticleContentExtractor, ContentExtractionService


@pytest.fixture
def sample_source(db_session: Session) -> NewsSource:
    src = NewsSource(name="Global Financial Times", base_url="https://gft.example.com")
    db_session.add(src)
    db_session.commit()
    db_session.refresh(src)
    return src


@pytest.fixture
def sample_news_article(db_session: Session, sample_source: NewsSource) -> Article:
    content = (
        'Chairman Jerome Powell announced today that the Federal Reserve lowered benchmark interest rates '
        'by 25 basis points in Washington. "We are committed to maintaining maximum employment while bringing '
        'inflation back to our two percent target," said Powell. Over 150 economists had forecasted the decision.'
    )
    art = Article(
        source_id=sample_source.id,
        title="Federal Reserve Lowers Interest Rates in Washington",
        content=content,
        url="https://gft.example.com/fed-cuts-rates-powell",
        published_at=datetime(2026, 11, 6, 14, 0, tzinfo=timezone.utc),
    )
    db_session.add(art)
    db_session.commit()
    db_session.refresh(art)
    return art


class TestContentExtractorUnit:
    def test_extract_topics(self):
        extractor = ArticleContentExtractor()
        text = "The Federal Reserve lowered interest rates today in Washington. Renewable energy investments increased."
        headline = "Federal Reserve Lowers Benchmark Rates"
        topics = extractor.extract_topics(text=text, headline=headline)

        assert len(topics) >= 1
        topic_names = [t["topic_name"] for t in topics]
        assert any("Federal Reserve" in name for name in topic_names)
        assert topics[0]["relevance_score"] >= 0.50

    def test_extract_entities(self):
        extractor = ArticleContentExtractor()
        text = "Chairman Jerome Powell and Elena Rostova held a briefing with the Federal Reserve in Washington."
        entities = extractor.extract_entities(text=text)

        entity_names = {e["name"]: e["entity_type"] for e in entities}
        assert "Jerome Powell" in entity_names
        assert entity_names["Jerome Powell"] == "PERSON"
        assert "Federal Reserve" in entity_names
        assert entity_names["Federal Reserve"] == "ORGANIZATION"
        assert "Washington" in entity_names
        assert entity_names["Washington"] == "LOCATION"

    def test_extract_facts(self):
        extractor = ArticleContentExtractor()
        text = "Over 190 delegations reached an agreement today. The committee voted to lower interest rates by 25 basis points."
        facts = extractor.extract_facts(text=text)

        assert len(facts) >= 1
        # Facts are source assertions and must have unverified status
        assert facts[0]["verification_status"] == "unverified"
        assert facts[0]["confidence_score"] >= 0.80
        assert facts[0]["start_char"] is not None
        assert facts[0]["end_char"] is not None

    def test_extract_quotes(self):
        extractor = ArticleContentExtractor()
        text = (
            'Summit discussions concluded positively. "This accord establishes an unprecedented commitment," '
            'said Elena Rostova. Later, analysts praised the deal.'
        )
        quotes = extractor.extract_quotes(text=text)

        assert len(quotes) == 1
        q = quotes[0]
        assert q["quote_text"] == "This accord establishes an unprecedented commitment,"
        assert q["speaker_name"] == "Elena Rostova"
        assert q["is_opinion"] is True
        assert q["source_type"] == "speaker_opinion"


class TestContentExtractionService:
    def test_extract_and_store_article_content(self, db_session: Session, sample_news_article: Article):
        service = ContentExtractionService()
        analysis = service.extract_and_store_article_content(db=db_session, article_id=sample_news_article.id)

        assert analysis.article_id == sample_news_article.id
        assert analysis.status == "completed"
        assert len(analysis.topics) >= 1
        assert len(analysis.entities) >= 1
        assert len(analysis.facts) >= 1
        assert len(analysis.quotes) >= 1

        # Check topics stored
        topic = analysis.topics[0]
        assert topic.topic_name != ""
        assert topic.relevance_score is not None

        # Check quote stored
        quote = analysis.quotes[0]
        assert "committed to maintaining maximum employment" in quote.quote_text
        assert quote.speaker_name == "Powell"

    def test_entity_deduplication_and_reuse(self, db_session: Session, sample_source: NewsSource):
        # Create an existing entity
        existing_entity = Entity(
            name="Federal Reserve",
            entity_type="ORGANIZATION",
            description="Central banking system",
        )
        db_session.add(existing_entity)
        db_session.commit()
        existing_id = existing_entity.id

        # Article mentioning Federal Reserve
        art = Article(
            source_id=sample_source.id,
            title="Federal Reserve Signals Policy Pause",
            content="The Federal Reserve met today in Washington to discuss credit facilities.",
            url="https://gft.example.com/fed-pause",
        )
        db_session.add(art)
        db_session.commit()

        service = ContentExtractionService()
        analysis = service.extract_and_store_article_content(db=db_session, article_id=art.id)

        # Entity count for "Federal Reserve" must still be 1 (reused)
        fed_entities = db_session.query(Entity).filter(Entity.name == "Federal Reserve").all()
        assert len(fed_entities) == 1
        assert fed_entities[0].id == existing_id

        # AnalysisEntity points to existing_id
        ae = db_session.query(AnalysisEntity).filter(
            AnalysisEntity.analysis_id == analysis.id,
            AnalysisEntity.entity_id == existing_id,
        ).first()
        assert ae is not None
        assert ae.mention_count >= 1


class TestContentExtractionAPIEndpoints:
    def test_get_article_content_extraction(self, client: TestClient, sample_news_article: Article):
        response = client.get(f"/api/articles/{sample_news_article.id}/extraction")
        assert response.status_code == 200
        data = response.json()
        assert data["article_id"] == sample_news_article.id
        assert "topics" in data
        assert "entities" in data
        assert "facts" in data
        assert "quotes" in data
        assert len(data["topics"]) >= 1
        assert len(data["entities"]) >= 1

    def test_trigger_article_content_extraction(self, client: TestClient, sample_news_article: Article):
        response = client.post(
            f"/api/articles/{sample_news_article.id}/extract",
            json={"force_reanalyze": True},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["article_id"] == sample_news_article.id
        assert data["status"] == "completed"

    def test_get_article_topics_subendpoint(self, client: TestClient, sample_news_article: Article):
        response = client.get(f"/api/articles/{sample_news_article.id}/topics")
        assert response.status_code == 200
        topics = response.json()
        assert isinstance(topics, list)
        assert len(topics) >= 1
        assert "topic_name" in topics[0]
        assert "relevance_score" in topics[0]

    def test_get_article_entities_subendpoint(self, client: TestClient, sample_news_article: Article):
        response = client.get(f"/api/articles/{sample_news_article.id}/entities")
        assert response.status_code == 200
        entities = response.json()
        assert isinstance(entities, list)
        assert len(entities) >= 1
        assert "entity_name" in entities[0]
        assert "entity_type" in entities[0]
        assert "salience_score" in entities[0]

    def test_get_article_facts_subendpoint(self, client: TestClient, sample_news_article: Article):
        response = client.get(f"/api/articles/{sample_news_article.id}/facts")
        assert response.status_code == 200
        facts = response.json()
        assert isinstance(facts, list)
        assert len(facts) >= 1
        assert facts[0]["verification_status"] == "unverified"

    def test_get_article_quotes_subendpoint(self, client: TestClient, sample_news_article: Article):
        response = client.get(f"/api/articles/{sample_news_article.id}/quotes")
        assert response.status_code == 200
        quotes = response.json()
        assert isinstance(quotes, list)
        assert len(quotes) >= 1
        assert quotes[0]["is_opinion"] is True
        assert quotes[0]["speaker_name"] == "Powell"

    def test_nonexistent_article_returns_404(self, client: TestClient):
        response = client.get("/api/articles/999999/extraction")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_api_v1_parity(self, client: TestClient, sample_news_article: Article):
        r_api = client.get(f"/api/articles/{sample_news_article.id}/extraction")
        r_v1 = client.get(f"/api/v1/articles/{sample_news_article.id}/extraction")
        assert r_api.status_code == 200
        assert r_v1.status_code == 200
        assert r_api.json()["id"] == r_v1.json()["id"]
