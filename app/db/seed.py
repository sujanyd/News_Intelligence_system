"""
Database seed script.

Inserts initial sample data for the News Bias and Framing Analysis System
and verifies foreign-key relationships and data integrity across tables.

Usage:
    python -m app.db.seed
"""

from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.db.session import engine, SessionLocal
from app.models import (
    Base,
    NewsSource,
    Story,
    Event,
    Article,
    ArticleEmbedding,
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
    ComparisonCoverage,
    ComparisonPoliticalSignal,
    AIDetectionResult,
    Report,
)


def seed_database(db: Session) -> dict:
    """
    Populates comprehensive sample data into the database and returns the inserted instances.
    """
    # 1. Insert a NewsSource
    source = db.query(NewsSource).filter_by(name="Reuters").first()
    if not source:
        source = NewsSource(
            name="Reuters",
            base_url="https://www.reuters.com",
        )
        db.add(source)
        db.flush()

    # 2. Insert a Story (overarching topic)
    story = db.query(Story).filter_by(title="Global Clean Energy Summit 2026").first()
    if not story:
        story = Story(
            title="Global Clean Energy Summit 2026",
        )
        db.add(story)
        db.flush()

    # 3. Insert an Event linked to the Story
    event = db.query(Event).filter_by(story_id=story.id).first()
    if not event:
        event = Event(
            story_id=story.id,
            event_time=datetime(2026, 10, 24, 14, 30, tzinfo=timezone.utc),
            event_time_precision="exact",
            event_time_disagreement=False,
        )
        db.add(event)
        db.flush()

    # 4. Insert an Article linked to the NewsSource and Event
    sample_url = "https://www.reuters.com/sustainability/clean-energy-summit-2026-pact-signed"
    article = db.query(Article).filter_by(url=sample_url).first()
    if not article:
        article = Article(
            source_id=source.id,
            event_id=event.id,
            title="World Leaders Finalize Landmark Clean Energy Transition Pact",
            content=(
                "Over 190 delegations reached a historic consensus in Geneva today, "
                "committing to triple renewable capacity investments over the next decade."
            ),
            url=sample_url,
            content_availability="full_text",
            canonical_url=sample_url,
            content_hash="d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
            published_at=datetime(2026, 10, 24, 15, 0, tzinfo=timezone.utc),
        )
        db.add(article)
        db.flush()

    # 5. Insert ArticleEmbedding metadata (referencing vector in Qdrant)
    embedding = db.query(ArticleEmbedding).filter_by(article_id=article.id, embedding_type="content").first()
    if not embedding:
        embedding = ArticleEmbedding(
            article_id=article.id,
            embedding_type="content",
            model_name="text-embedding-3-small",
            vector_reference="qdrant-pt-8e3b-reuters-clean-energy",
            dimensions=1536,
        )
        db.add(embedding)
        db.flush()

    # 6. Insert ArticleAnalysis run
    analysis = db.query(ArticleAnalysis).filter_by(article_id=article.id, pipeline_version="v1.0.0").first()
    if not analysis:
        analysis = ArticleAnalysis(
            article_id=article.id,
            pipeline_version="v1.0.0",
            bias_score=0.02,
            bias_label="center",
            sentiment_score=0.35,
            sentiment_label="positive",
            confidence_score=0.94,
            summary="Objective reporting summarizing the multilateral renewable investment pact in Geneva.",
        )
        db.add(analysis)
        db.flush()

        # Evidence: Topic
        topic = AnalysisTopic(
            analysis_id=analysis.id,
            topic_name="Renewable Capacity Investment",
            relevance_score=0.96,
            start_char=74,
            end_char=117,
            evidence_text="triple renewable capacity investments",
        )
        # Evidence: Fact
        fact = AnalysisFact(
            analysis_id=analysis.id,
            fact_statement="Over 190 delegations agreed to triple renewable capacity investments.",
            verification_status="verified",
            confidence_score=0.98,
        )
        # Evidence: Quote
        quote = AnalysisQuote(
            analysis_id=analysis.id,
            quote_text="This accord establishes an unprecedented multilateral commitment toward carbon neutrality.",
            speaker_name="Elena Rostova",
            speaker_title="Summit Co-Chair",
            source_type="speaker_opinion",
            is_opinion=True,
            sentiment_score=0.6,
        )
        # Evidence: Framing signal
        framing = AnalysisFramingSignal(
            analysis_id=analysis.id,
            frame_type="cooperative_progress",
            intensity_score=0.7,
            evidence_text="historic consensus in Geneva",
            explanation="Emphasizes international consensus and multilateral breakthrough.",
        )
        db.add_all([topic, fact, quote, framing])
        db.flush()

    # 7. Insert Entity & Alias
    entity = db.query(Entity).filter_by(name="United Nations Framework Convention").first()
    if not entity:
        entity = Entity(
            name="United Nations Framework Convention",
            entity_type="ORGANIZATION",
            description="UN entity tasked with supporting the global response to climate change.",
        )
        db.add(entity)
        db.flush()

        alias = EntityAlias(
            entity_id=entity.id,
            alias="UNFCCC",
        )
        db.add(alias)

        analysis_entity = AnalysisEntity(
            analysis_id=analysis.id,
            entity_id=entity.id,
            mention_count=2,
            sentiment_score=0.3,
            salience_score=0.8,
            role="coordinating_body",
        )
        db.add(analysis_entity)
        db.flush()

    # 8. Insert NewsComparison session
    comparison = db.query(NewsComparison).filter_by(title="Clean Energy Summit 2026 Framing Comparison").first()
    if not comparison:
        comparison = NewsComparison(
            event_id=event.id,
            title="Clean Energy Summit 2026 Framing Comparison",
            description="Cross-media comparative analysis of the 2026 Geneva energy accord.",
            status="completed",
        )
        db.add(comparison)
        db.flush()

        comp_article = ComparisonArticle(
            comparison_id=comparison.id,
            article_id=article.id,
        )
        db.add(comp_article)
        db.flush()

        comp_coverage = ComparisonCoverage(
            comparison_id=comparison.id,
            article_id=article.id,
            coverage_score=0.91,
            tone_score=0.3,
            primary_frame="economic_transition",
            omitted_topics="Short-term developing country financing hurdles.",
        )
        comp_signal = ComparisonPoliticalSignal(
            comparison_id=comparison.id,
            article_id=article.id,
            political_leaning="center",
            slant_score=0.02,
            partisanship_score=0.08,
            signal_description="Balanced factual coverage with neutral attribution.",
        )
        db.add_all([comp_coverage, comp_signal])
        db.flush()

    # 9. Insert AI Detection Result
    ai_detection = db.query(AIDetectionResult).filter_by(article_id=article.id).first()
    if not ai_detection:
        ai_detection = AIDetectionResult(
            article_id=article.id,
            ai_likelihood=0.08,
            model_name="roberta-base-openai-detector",
            model_version="v2.1",
            confidence_score=0.92,
            analysis_details='{"burstiness_score": 0.78, "perplexity": 62.4}',
            is_flagged_for_review=False,
        )
        db.add(ai_detection)
        db.flush()

    # 10. Insert Intelligence Report
    report = db.query(Report).filter_by(comparison_id=comparison.id).first()
    if not report:
        report = Report(
            comparison_id=comparison.id,
            title="Synthesis Report: Media Consensus and Divergence at Geneva Energy Summit",
            summary="Analysis demonstrates broad convergence on treaty milestones with subtle framing variations in economic viability.",
            content=(
                "# Executive Intelligence Report: Geneva Energy Summit\n\n"
                "## Overview\n"
                "Reporting on the 2026 Clean Energy Transition Pact shows high factual consensus across international wires, "
                "with divergence primarily appearing in long-term cost burden attribution."
            ),
            report_format="markdown",
        )
        db.add(report)
        db.flush()

    db.commit()
    db.refresh(source)
    db.refresh(story)
    db.refresh(event)
    db.refresh(article)

    return {
        "source": source,
        "story": story,
        "event": event,
        "article": article,
        "embedding": embedding,
        "analysis": analysis,
        "entity": entity,
        "comparison": comparison,
        "report": report,
    }


def run_seed() -> None:
    """Creates tables if not present and runs the seed process."""
    print("Ensuring database tables exist...")
    Base.metadata.create_all(bind=engine)

    print("Seeding sample data...")
    db = SessionLocal()
    try:
        data = seed_database(db)
        print("✓ Sample data seeded successfully across all schema modules!")
        print(f"  - Source: {data['source'].name} ({data['source'].base_url})")
        print(f"  - Story: {data['story'].title}")
        print(f"  - Event: ID={data['event'].id}, Time={data['event'].event_time}, Precision={data['event'].event_time_precision}")
        print(f"  - Article: '{data['article'].title}' (Availability: {data['article'].content_availability})")
        print(f"  - Embedding: Qdrant ref '{data['embedding'].vector_reference}' ({data['embedding'].model_name})")
        print(f"  - Analysis: Bias={data['analysis'].bias_label}, Sentiment={data['analysis'].sentiment_label}")
        print(f"  - Entity: '{data['entity'].name}' ({data['entity'].entity_type})")
        print(f"  - Comparison: '{data['comparison'].title}'")
        print(f"  - Report: '{data['report'].title}'")
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
