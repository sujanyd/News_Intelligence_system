"""
CLI Script to Re-index Article Embeddings into Qdrant Vector Database.

Usage:
    python -m scripts.reindex_embeddings [--force] [--type all|headline|body]
"""

import argparse
import logging
import sys

from app.core.config import settings
from app.db.session import SessionLocal
from app.services.embedding import (
    get_embedding_provider,
    run_article_embedding_generation,
)
from app.services.vector_db import get_vector_db_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("scripts.reindex_embeddings")


def main():
    parser = argparse.ArgumentParser(description="Re-index article embeddings with semantic vector search.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force regeneration of embeddings even if already indexed for this model.",
    )
    parser.add_argument(
        "--type",
        choices=["all", "headline", "body"],
        default="all",
        help="Target content to embed (default: all).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum articles to process (optional).",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        provider = get_embedding_provider()
        vector_db = get_vector_db_service()

        logger.info(
            "Starting re-indexing procedure using provider='%s', model='%s', dimensions=%d",
            settings.EMBEDDING_PROVIDER,
            provider.model_name,
            provider.dimensions,
        )
        logger.info("Target Qdrant collection: '%s'", vector_db.collection_name)

        summary = run_article_embedding_generation(
            db=db,
            embedding_type=args.type,
            force_regenerate=args.force,
            limit=args.limit,
            provider=provider,
            vector_db=vector_db,
        )

        logger.info(
            "Re-indexing complete: %d generated, %d skipped, %d errors (out of %d articles evaluated)",
            summary.embeddings_generated,
            summary.articles_skipped,
            summary.errors_encountered,
            summary.articles_considered,
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()

