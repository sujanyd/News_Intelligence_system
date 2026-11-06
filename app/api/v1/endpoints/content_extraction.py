"""
Article Content Extraction API Endpoints.

Provides endpoints to:
1. Trigger or retrieve full content extraction (topics, entities, facts, quotes) for an article.
2. Retrieve extracted topics for an article.
3. Retrieve extracted entities for an article.
4. Retrieve extracted factual statements for an article.
5. Retrieve extracted quotations and attributed speakers for an article.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.analysis_entity import AnalysisEntity
from app.models.analysis_fact import AnalysisFact
from app.models.analysis_quote import AnalysisQuote
from app.models.analysis_topic import AnalysisTopic
from app.models.article import Article
from app.models.article_analysis import ArticleAnalysis
from app.schemas.content_extraction import (
    AnalysisEntityResponse,
    ArticleAnalysisSummaryResponse,
    ArticleContentExtractionResponse,
    ExtractContentRequest,
    FactResponse,
    QuoteResponse,
    TopicResponse,
)
from app.services.content_extraction import get_content_extraction_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/{article_id}/extraction",
    response_model=ArticleContentExtractionResponse,
    summary="Get extracted content for an article",
    description="Retrieves the latest extracted topics, entities, facts, and quotes for the specified article.",
)
def get_article_content_extraction(
    article_id: int,
    db: Session = Depends(get_db),
):
    service = get_content_extraction_service()
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Article with ID {article_id} not found.",
        )

    analysis = service.get_latest_article_analysis(db=db, article_id=article_id)
    if not analysis:
        # If no analysis run yet, automatically perform initial extraction
        analysis = service.extract_and_store_article_content(db=db, article_id=article_id)

    # Format entities response with entity name and type
    entities_formatted = [
        AnalysisEntityResponse(
            id=ae.id,
            analysis_id=ae.analysis_id,
            entity_id=ae.entity_id,
            entity_name=ae.entity.name if ae.entity else "Unknown",
            entity_type=ae.entity.entity_type if ae.entity else "CONCEPT",
            mention_count=ae.mention_count,
            sentiment_score=ae.sentiment_score,
            salience_score=ae.salience_score,
            role=ae.role,
        )
        for ae in analysis.entities
    ]

    return ArticleContentExtractionResponse(
        id=analysis.id,
        article_id=analysis.article_id,
        pipeline_version=analysis.pipeline_version,
        status=analysis.status,
        bias_score=analysis.bias_score,
        bias_label=analysis.bias_label,
        sentiment_score=analysis.sentiment_score,
        sentiment_label=analysis.sentiment_label,
        confidence_score=analysis.confidence_score,
        summary=analysis.summary,
        created_at=analysis.created_at,
        topics=[TopicResponse.model_validate(t) for t in analysis.topics],
        entities=entities_formatted,
        facts=[FactResponse.model_validate(f) for f in analysis.facts],
        quotes=[QuoteResponse.model_validate(q) for q in analysis.quotes],
    )


@router.post(
    "/{article_id}/extract",
    response_model=ArticleContentExtractionResponse,
    summary="Trigger article content extraction",
    description="Analyzes the article content and extracts topics, entities, facts, and quotes.",
)
def trigger_article_content_extraction(
    article_id: int,
    payload: Optional[ExtractContentRequest] = None,
    db: Session = Depends(get_db),
):
    service = get_content_extraction_service()
    force_reanalyze = payload.force_reanalyze if payload else False
    try:
        analysis = service.extract_and_store_article_content(
            db=db,
            article_id=article_id,
            force_reanalyze=force_reanalyze,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Content extraction failed for article %d: %s", article_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Content extraction failed: {exc}",
        )

    entities_formatted = [
        AnalysisEntityResponse(
            id=ae.id,
            analysis_id=ae.analysis_id,
            entity_id=ae.entity_id,
            entity_name=ae.entity.name if ae.entity else "Unknown",
            entity_type=ae.entity.entity_type if ae.entity else "CONCEPT",
            mention_count=ae.mention_count,
            sentiment_score=ae.sentiment_score,
            salience_score=ae.salience_score,
            role=ae.role,
        )
        for ae in analysis.entities
    ]

    return ArticleContentExtractionResponse(
        id=analysis.id,
        article_id=analysis.article_id,
        pipeline_version=analysis.pipeline_version,
        status=analysis.status,
        bias_score=analysis.bias_score,
        bias_label=analysis.bias_label,
        sentiment_score=analysis.sentiment_score,
        sentiment_label=analysis.sentiment_label,
        confidence_score=analysis.confidence_score,
        summary=analysis.summary,
        created_at=analysis.created_at,
        topics=[TopicResponse.model_validate(t) for t in analysis.topics],
        entities=entities_formatted,
        facts=[FactResponse.model_validate(f) for f in analysis.facts],
        quotes=[QuoteResponse.model_validate(q) for q in analysis.quotes],
    )


@router.get(
    "/{article_id}/topics",
    response_model=List[TopicResponse],
    summary="Get extracted topics for an article",
    description="Returns topics identified in the article along with relevance scores and evidence excerpts.",
)
def get_article_topics(
    article_id: int,
    db: Session = Depends(get_db),
):
    service = get_content_extraction_service()
    analysis = service.get_latest_article_analysis(db=db, article_id=article_id)
    if not analysis:
        analysis = service.extract_and_store_article_content(db=db, article_id=article_id)
    return [TopicResponse.model_validate(t) for t in analysis.topics]


@router.get(
    "/{article_id}/entities",
    response_model=List[AnalysisEntityResponse],
    summary="Get extracted entities for an article",
    description="Returns named entities mentioned in the article with mention counts and salience scores.",
)
def get_article_entities(
    article_id: int,
    db: Session = Depends(get_db),
):
    service = get_content_extraction_service()
    analysis = service.get_latest_article_analysis(db=db, article_id=article_id)
    if not analysis:
        analysis = service.extract_and_store_article_content(db=db, article_id=article_id)

    return [
        AnalysisEntityResponse(
            id=ae.id,
            analysis_id=ae.analysis_id,
            entity_id=ae.entity_id,
            entity_name=ae.entity.name if ae.entity else "Unknown",
            entity_type=ae.entity.entity_type if ae.entity else "CONCEPT",
            mention_count=ae.mention_count,
            sentiment_score=ae.sentiment_score,
            salience_score=ae.salience_score,
            role=ae.role,
        )
        for ae in analysis.entities
    ]


@router.get(
    "/{article_id}/facts",
    response_model=List[FactResponse],
    summary="Get extracted factual statements for an article",
    description="Returns extracted factual claims, confidence scores, and character boundaries.",
)
def get_article_facts(
    article_id: int,
    db: Session = Depends(get_db),
):
    service = get_content_extraction_service()
    analysis = service.get_latest_article_analysis(db=db, article_id=article_id)
    if not analysis:
        analysis = service.extract_and_store_article_content(db=db, article_id=article_id)
    return [FactResponse.model_validate(f) for f in analysis.facts]


@router.get(
    "/{article_id}/quotes",
    response_model=List[QuoteResponse],
    summary="Get extracted quotations for an article",
    description="Returns verbatim quote statements along with attributed speakers and opinion indicators.",
)
def get_article_quotes(
    article_id: int,
    db: Session = Depends(get_db),
):
    service = get_content_extraction_service()
    analysis = service.get_latest_article_analysis(db=db, article_id=article_id)
    if not analysis:
        analysis = service.extract_and_store_article_content(db=db, article_id=article_id)
    return [QuoteResponse.model_validate(q) for q in analysis.quotes]
