"""
Vector Database Service Module.

Provides an enterprise-ready, robust abstraction over Qdrant Vector Search.
Responsible for:
1. Connecting to the vector database with configurable host/URL/api_key or in-memory mode.
2. Creating and verifying collections with specified vector dimensions and distance metric.
3. Storing article embedding vectors with metadata payloads (article_id, embedding_type, model_name).
4. Retrieving vectors by similarity using Cosine distance, excluding the query article itself.
5. Deleting or replacing vectors safely when regenerating embeddings.
6. Graceful error handling and fault tolerance when Qdrant is unreachable.
"""

import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple, Union

from pydantic import BaseModel, Field

try:
    from qdrant_client import QdrantClient
    from qdrant_client.http import models as qmodels
    from qdrant_client.http.exceptions import UnexpectedResponse
    QDRANT_AVAILABLE = True
except ImportError:  # pragma: no cover
    QDRANT_AVAILABLE = False
    QdrantClient = None
    qmodels = None
    UnexpectedResponse = Exception

from app.core.config import settings

logger = logging.getLogger(__name__)


class VectorSearchResult(BaseModel):
    """
    Representation of a vector search similarity match.
    Does not expose raw dense vector arrays in API/service results.
    """
    article_id: int = Field(..., description="ID of the matched article in PostgreSQL")
    vector_id: str = Field(..., description="Point ID / UUID of the vector in Qdrant")
    similarity_score: float = Field(..., description="Cosine similarity score (0.0 to 1.0)")
    embedding_type: str = Field(..., description="Target type of the matched vector ('headline' or 'body')")
    model_name: str = Field(..., description="Embedding model name used to generate this vector")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Metadata payload stored with the vector")


class VectorDatabaseService:
    """
    Service client for interacting with Qdrant vector database.
    """

    def __init__(
        self,
        client: Optional[Any] = None,
        collection_name: Optional[str] = None,
        dimensions: Optional[int] = None,
        distance: Optional[str] = None,
    ):
        """
        Initialize the VectorDatabaseService.

        Args:
            client: Optional pre-configured QdrantClient instance (e.g. for testing with :memory:).
            collection_name: Optional custom collection name; defaults to settings.QDRANT_COLLECTION_NAME.
            dimensions: Vector dimensionality (defaults to settings.EMBEDDING_DIMENSIONS).
            distance: Distance metric ('Cosine', 'Dot', 'Euclid'; defaults to settings.QDRANT_DISTANCE).
        """
        self.collection_name = collection_name or settings.QDRANT_COLLECTION_NAME
        self.dimensions = dimensions or settings.EMBEDDING_DIMENSIONS
        self.distance_name = distance or settings.QDRANT_DISTANCE

        if client is not None:
            self._client = client
        else:
            self._client = self._init_client()

    def _init_client(self) -> Any:
        """
        Creates and returns a QdrantClient based on settings.
        """
        if not QDRANT_AVAILABLE:
            raise RuntimeError(
                "qdrant-client is not installed. Install via `pip install qdrant-client`."
            )

        # Check if custom QDRANT_URL is provided (e.g., ':memory:' or cloud URL)
        if settings.QDRANT_URL:
            if settings.QDRANT_URL == ":memory:":
                logger.info("Initializing in-memory Qdrant client for local testing/development.")
                return QdrantClient(":memory:")
            return QdrantClient(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY if settings.QDRANT_API_KEY else None,
                timeout=settings.QDRANT_TIMEOUT_SECONDS,
                prefer_grpc=settings.QDRANT_PREFER_GRPC,
            )

        # Default host + port configuration
        return QdrantClient(
            host=settings.QDRANT_HOST,
            port=settings.QDRANT_PORT,
            grpc_port=settings.QDRANT_GRPC_PORT,
            api_key=settings.QDRANT_API_KEY if settings.QDRANT_API_KEY else None,
            timeout=settings.QDRANT_TIMEOUT_SECONDS,
            prefer_grpc=settings.QDRANT_PREFER_GRPC,
        )

    @property
    def client(self) -> Any:
        return self._client

    def _get_qdrant_distance(self) -> Any:
        """
        Maps string distance name to Qdrant distance model.
        """
        metric = self.distance_name.strip().lower()
        if metric == "dot":
            return qmodels.Distance.DOT
        if metric == "euclid":
            return qmodels.Distance.EUCLID
        return qmodels.Distance.COSINE

    def is_healthy(self) -> bool:
        """
        Checks if the vector database client can communicate with the server.
        """
        try:
            self._client.get_collections()
            return True
        except Exception as exc:
            logger.warning("Vector database health check failed: %s", exc)
            return False

    def ensure_collection(
        self,
        collection_name: Optional[str] = None,
        dimensions: Optional[int] = None,
    ) -> bool:
        """
        Verifies if collection exists in Qdrant; creates it if missing.

        Returns:
            True if created or already exists.
        """
        target_col = collection_name or self.collection_name
        target_dim = dimensions or self.dimensions

        try:
            collections = self._client.get_collections().collections
            existing_names = [c.name for c in collections]

            if target_col in existing_names:
                logger.debug("Qdrant collection '%s' already exists.", target_col)
                return True

            distance = self._get_qdrant_distance()
            self._client.create_collection(
                collection_name=target_col,
                vectors_config=qmodels.VectorParams(
                    size=target_dim,
                    distance=distance,
                ),
            )
            logger.info(
                "Created Qdrant collection '%s' (dim=%d, distance=%s).",
                target_col,
                target_dim,
                self.distance_name,
            )
            return True
        except Exception as exc:
            logger.error(
                "Failed to ensure Qdrant collection '%s': %s",
                target_col,
                exc,
            )
            raise

    def store_vector(
        self,
        vector_id: str,
        vector: List[float],
        article_id: int,
        embedding_type: str,
        model_name: str,
        extra_payload: Optional[Dict[str, Any]] = None,
        collection_name: Optional[str] = None,
    ) -> str:
        """
        Stores or updates an article embedding vector in the collection.

        Args:
            vector_id: Unique string identifier (e.g. UUID string or Point ID).
            vector: High-dimensional vector array.
            article_id: Foreign key to PostgreSQL Article.
            embedding_type: 'headline' or 'body'.
            model_name: Embedding model identifier.
            extra_payload: Additional metadata to store with the vector.
            collection_name: Optional collection override.

        Returns:
            The valid vector point ID stored in Qdrant.
        """
        target_col = collection_name or self.collection_name
        self.ensure_collection(target_col, dimensions=len(vector))

        # Payload metadata
        payload = {
            "article_id": article_id,
            "embedding_type": embedding_type,
            "model_name": model_name,
            **(extra_payload or {}),
        }

        # Convert vector_id to a valid Qdrant point ID (UUID or unsigned int)
        point_id = self._to_point_id(vector_id)

        point = qmodels.PointStruct(
            id=point_id,
            vector=vector,
            payload=payload,
        )

        self._client.upsert(
            collection_name=target_col,
            points=[point],
            wait=True,
        )

        logger.debug(
            "Upserted vector point='%s' for article_id=%d, type='%s' in collection '%s'",
            point_id,
            article_id,
            embedding_type,
            target_col,
        )
        return str(point_id)

    def delete_vector(
        self,
        vector_id: str,
        collection_name: Optional[str] = None,
    ) -> bool:
        """
        Safely deletes a vector from Qdrant by its point ID.
        """
        target_col = collection_name or self.collection_name
        try:
            point_id = self._to_point_id(vector_id)
            self._client.delete(
                collection_name=target_col,
                points_selector=qmodels.PointIdsList(points=[point_id]),
                wait=True,
            )
            logger.debug("Deleted vector point='%s' from collection '%s'", point_id, target_col)
            return True
        except Exception as exc:
            logger.warning("Failed to delete vector point '%s': %s", vector_id, exc)
            return False

    def delete_by_article_id(
        self,
        article_id: int,
        embedding_type: Optional[str] = None,
        collection_name: Optional[str] = None,
    ) -> int:
        """
        Deletes all vector points associated with an article_id (and optionally embedding_type).
        """
        target_col = collection_name or self.collection_name
        try:
            conditions: List[Any] = [
                qmodels.FieldCondition(
                    key="article_id",
                    match=qmodels.MatchValue(value=article_id),
                )
            ]
            if embedding_type:
                conditions.append(
                    qmodels.FieldCondition(
                        key="embedding_type",
                        match=qmodels.MatchValue(value=embedding_type),
                    )
                )

            filter_query = qmodels.Filter(must=conditions)
            self._client.delete(
                collection_name=target_col,
                points_selector=qmodels.FilterSelector(filter=filter_query),
                wait=True,
            )
            return 1
        except Exception as exc:
            logger.error("Failed to delete vectors for article_id=%d: %s", article_id, exc)
            return 0

    def search_similar(
        self,
        query_vector: List[float],
        limit: int = 10,
        exclude_article_id: Optional[int] = None,
        embedding_type: Optional[str] = None,
        model_name: Optional[str] = None,
        score_threshold: Optional[float] = None,
        collection_name: Optional[str] = None,
    ) -> List[VectorSearchResult]:
        """
        Finds the top similar vectors in Qdrant, with payload filtering and self-exclusion.

        Args:
            query_vector: Dense vector for similarity comparison.
            limit: Maximum number of matches to return.
            exclude_article_id: Article ID to filter OUT (excludes the article itself).
            embedding_type: Optional filter by embedding target ('headline' or 'body').
            model_name: Optional filter by model name.
            score_threshold: Minimum similarity score threshold (0.0 - 1.0).
            collection_name: Optional collection override.

        Returns:
            List of VectorSearchResult objects sorted by similarity descending.
        """
        target_col = collection_name or self.collection_name

        # Build Qdrant filter
        must_conditions: List[Any] = []
        must_not_conditions: List[Any] = []

        if exclude_article_id is not None:
            must_not_conditions.append(
                qmodels.FieldCondition(
                    key="article_id",
                    match=qmodels.MatchValue(value=exclude_article_id),
                )
            )

        if embedding_type:
            must_conditions.append(
                qmodels.FieldCondition(
                    key="embedding_type",
                    match=qmodels.MatchValue(value=embedding_type),
                )
            )

        if model_name:
            must_conditions.append(
                qmodels.FieldCondition(
                    key="model_name",
                    match=qmodels.MatchValue(value=model_name),
                )
            )

        filter_obj = None
        if must_conditions or must_not_conditions:
            filter_obj = qmodels.Filter(
                must=must_conditions if must_conditions else None,
                must_not=must_not_conditions if must_not_conditions else None,
            )

        try:
            # Query Qdrant using client.query_points or client.search
            if hasattr(self._client, "query_points"):
                search_response = self._client.query_points(
                    collection_name=target_col,
                    query=query_vector,
                    query_filter=filter_obj,
                    limit=limit,
                    score_threshold=score_threshold,
                    with_payload=True,
                )
                points = search_response.points
            else:
                points = self._client.search(
                    collection_name=target_col,
                    query_vector=query_vector,
                    query_filter=filter_obj,
                    limit=limit,
                    score_threshold=score_threshold,
                    with_payload=True,
                )

            results: List[VectorSearchResult] = []
            for hit in points:
                payload = hit.payload or {}
                matched_article_id = payload.get("article_id")
                if matched_article_id is None:
                    continue

                # Defensive check: ensure article itself is never returned
                if exclude_article_id is not None and matched_article_id == exclude_article_id:
                    continue

                results.append(
                    VectorSearchResult(
                        article_id=matched_article_id,
                        vector_id=str(hit.id),
                        similarity_score=float(hit.score),
                        embedding_type=str(payload.get("embedding_type", "unknown")),
                        model_name=str(payload.get("model_name", "")),
                        payload=payload,
                    )
                )

            return results
        except Exception as exc:
            logger.error("Vector search failed on collection '%s': %s", target_col, exc)
            raise

    def get_vector_by_id(
        self,
        vector_id: str,
        collection_name: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieves a single vector and its payload by ID.
        """
        target_col = collection_name or self.collection_name
        point_id = self._to_point_id(vector_id)
        try:
            records = self._client.retrieve(
                collection_name=target_col,
                ids=[point_id],
                with_vectors=True,
                with_payload=True,
            )
            if not records:
                return None
            record = records[0]
            return {
                "id": str(record.id),
                "vector": record.vector,
                "payload": record.payload,
            }
        except Exception as exc:
            logger.warning("Failed to retrieve vector '%s': %s", vector_id, exc)
            return None

    @staticmethod
    def _to_point_id(vector_id: str) -> Union[str, int]:
        """
        Converts any arbitrary string or UUID into a valid Qdrant point ID.
        If the vector_id is a valid UUID, returns it as UUID string.
        Otherwise, converts it deterministically to a UUIDv5.
        """
        vector_id_str = str(vector_id).strip()
        try:
            # Check if already a valid UUID
            val = uuid.UUID(vector_id_str)
            return str(val)
        except ValueError:
            # Deterministically hash arbitrary string (e.g. art-1-headline-3f2a1b) into UUIDv5
            return str(uuid.uuid5(uuid.NAMESPACE_DNS, vector_id_str))


# Global singleton instance provider
_vector_db_service: Optional[VectorDatabaseService] = None


def get_vector_db_service() -> VectorDatabaseService:
    """
    Returns the singleton instance of VectorDatabaseService.
    Can be overridden or reset during testing.
    """
    global _vector_db_service
    if _vector_db_service is None:
        _vector_db_service = VectorDatabaseService()
    return _vector_db_service


def set_vector_db_service(service: Optional[VectorDatabaseService]) -> None:
    """
    Helper function to set or reset the vector DB service singleton (useful for tests).
    """
    global _vector_db_service
    _vector_db_service = service

